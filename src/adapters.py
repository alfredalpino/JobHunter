from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote_plus, urlparse

import feedparser

from extract import extract_html_jobs, extract_markdown_jobs
from firecrawl_client import firecrawl_scrape_markdown, firecrawl_search, polite_pause
from http_client import PoliteClient
from models import Job, PortalResult

REMOTE_TAGS = re.compile(
    r"\b(network|noc|sysadmin|sys-admin|cisco|ccna|security|infrastructure|linux|support|it)\b",
    re.I,
)


def fill_url(template: str, query: str, location: str = "") -> str:
    q = query.strip()
    loc = (location or "").strip()
    loc_slug = re.sub(r"[^a-z0-9]+", "-", loc.lower()).strip("-")
    return (
        template.replace("{query_plus}", quote_plus(q))
        .replace("{query_dash}", re.sub(r"\s+", "-", q.lower()))
        .replace("{query}", quote_plus(q))
        .replace("{location_plus}", quote_plus(loc))
        .replace("{location_slug}", loc_slug)
        .replace("{location}", quote_plus(loc) if loc else "")
    )


def _from_search_hits(
    hits: list[dict[str, Any]], *, portal: str, query: str, method: str
) -> list[Job]:
    jobs: list[Job] = []
    seen: set[str] = set()
    for hit in hits:
        url = (hit.get("url") or hit.get("link") or "").strip()
        title = (hit.get("title") or "").strip()
        if not url or not title or url in seen:
            continue
        jobs.append(
            Job(
                title=title[:180],
                company=_company_from_host(url),
                url=url,
                portal=portal,
                summary=(hit.get("description") or hit.get("snippet") or title)[:400],
                source_method=method,
                query=query,
            )
        )
        seen.add(url)
    return jobs


def _company_from_host(url: str) -> str:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    base = host.split(".")[0] if host else ""
    if base in {"jobs", "careers", "ae", "www"}:
        return "unspecified"
    return base.replace("-", " ").title() or "unspecified"


def scrape_remoteok(client: PoliteClient, portal: dict[str, Any], queries: list[str]) -> PortalResult:
    result = PortalResult(portal["id"], portal["name"], "remoteok_api")
    url = (portal.get("search_urls") or ["https://remoteok.com/api"])[0]
    result.fetched_urls.append(url)
    status, data = client.get_json(url)
    if status != 200 or not isinstance(data, list):
        result.error = f"RemoteOK HTTP {status}"
        return result
    needles = [q.lower() for q in queries]
    for row in data:
        if not isinstance(row, dict) or not row.get("position"):
            continue
        title = str(row.get("position") or "")
        blob = " ".join(
            [
                title,
                str(row.get("location") or ""),
                " ".join(str(t) for t in (row.get("tags") or [])),
                str(row.get("description") or "")[:800],
            ]
        )
        if not REMOTE_TAGS.search(title) and not any(n in title.lower() for n in needles):
            continue
        loc = str(row.get("location") or "")
        if loc and not re.search(r"asia|uae|dubai|worldwide|remote|anywhere|gcc", loc, re.I):
            if "ok" not in loc.lower() and loc.lower() not in {"", "remote"}:
                # keep worldwide-style rows; drop clearly US/EU-only later in eligibility
                pass
        posted = row.get("date") or row.get("epoch") or ""
        result.jobs.append(
            Job(
                title=title[:180],
                company=str(row.get("company") or "unspecified"),
                url=str(row.get("url") or row.get("apply_url") or ""),
                portal=portal["id"],
                location=loc,
                summary=re.sub(r"<[^>]+>", " ", str(row.get("description") or ""))[:400],
                source_method="remoteok_api",
                query="remoteok-api",
                posted_at=str(posted),
            )
        )
    result.jobs = [j for j in result.jobs if j.url]
    return result


def scrape_remotive(client: PoliteClient, portal: dict[str, Any], queries: list[str]) -> PortalResult:
    result = PortalResult(portal["id"], portal["name"], "remotive_api")
    templates = portal.get("search_urls") or [
        "https://remotive.com/api/remote-jobs?search={query_plus}&limit=50"
    ]
    seen: set[str] = set()
    for query in queries:
        url = fill_url(templates[0], query)
        result.fetched_urls.append(url)
        status, data = client.get_json(url)
        if status != 200 or not isinstance(data, dict):
            result.error = f"Remotive HTTP {status}"
            continue
        for row in data.get("jobs") or []:
            if not isinstance(row, dict):
                continue
            job_url = str(row.get("url") or row.get("canonical_url") or "")
            title = str(row.get("title") or "")
            if not job_url or not title or job_url in seen:
                continue
            if not REMOTE_TAGS.search(title) and "network" not in title.lower() and "noc" not in title.lower():
                continue
            seen.add(job_url)
            result.jobs.append(
                Job(
                    title=title[:180],
                    company=str(row.get("company_name") or "unspecified"),
                    url=job_url,
                    portal=portal["id"],
                    location=str(row.get("candidate_required_location") or "Remote"),
                    summary=re.sub(r"<[^>]+>", " ", str(row.get("description") or ""))[:400],
                    source_method="remotive_api",
                    query=query,
                    posted_at=str(row.get("publication_date") or ""),
                )
            )
    return result


def _query_match(title: str, blob: str, queries: list[str]) -> bool:
    low_title = title.lower()
    low_blob = blob.lower()
    if REMOTE_TAGS.search(title):
        return True
    for q in queries:
        tokens = [t for t in q.lower().split() if len(t) > 2]
        if not tokens:
            if q.lower() in low_title or q.lower() in low_blob:
                return True
            continue
        if all(t in low_blob for t in tokens) or q.lower() in low_title:
            return True
    return False


def scrape_arbeitnow(client: PoliteClient, portal: dict[str, Any], queries: list[str]) -> PortalResult:
    result = PortalResult(portal["id"], portal["name"], "arbeitnow_api")
    templates = portal.get("search_urls") or [
        "https://www.arbeitnow.com/api/job-board-api?search={query_plus}"
    ]
    seen: set[str] = set()
    for query in queries[:2]:
        url = fill_url(templates[0], query)
        result.fetched_urls.append(url)
        status, data = client.get_json(url)
        if status != 200 or not isinstance(data, dict):
            result.error = f"Arbeitnow HTTP {status}"
            continue
        for row in data.get("data") or []:
            if not isinstance(row, dict):
                continue
            job_url = str(row.get("url") or "")
            title = str(row.get("title") or "")
            if not job_url or not title or job_url in seen:
                continue
            desc = re.sub(r"<[^>]+>", " ", str(row.get("description") or ""))
            blob = f"{title} {row.get('location') or ''} {desc[:500]}"
            if not _query_match(title, blob, queries):
                continue
            seen.add(job_url)
            created = row.get("created_at")
            result.jobs.append(
                Job(
                    title=title[:180],
                    company=str(row.get("company_name") or "unspecified")[:120],
                    url=job_url,
                    portal=portal["id"],
                    location=str(row.get("location") or "Remote"),
                    summary=desc[:400],
                    source_method="arbeitnow_api",
                    query=query,
                    posted_at=str(created) if created is not None else "",
                )
            )
            if len(result.jobs) >= 60:
                return result
    return result


def scrape_jobicy(client: PoliteClient, portal: dict[str, Any], queries: list[str]) -> PortalResult:
    result = PortalResult(portal["id"], portal["name"], "jobicy_api")
    templates = portal.get("search_urls") or [
        "https://jobicy.com/api/v2/remote-jobs?count=50&tag={query}"
    ]
    seen: set[str] = set()
    for query in queries[:2]:
        tag = query.strip().split()[0] if query.strip() else "dev"
        url = fill_url(templates[0], tag)
        result.fetched_urls.append(url)
        status, data = client.get_json(url)
        if status != 200 or not isinstance(data, dict):
            result.error = f"Jobicy HTTP {status}"
            continue
        for row in data.get("jobs") or []:
            if not isinstance(row, dict):
                continue
            title = str(row.get("jobTitle") or row.get("title") or "")
            raw_url = str(row.get("url") or row.get("id") or "")
            if not title or not raw_url:
                continue
            href = raw_url if raw_url.startswith("http") else f"https://jobicy.com/jobs/{raw_url}"
            if href in seen:
                continue
            desc = re.sub(
                r"<[^>]+>",
                " ",
                str(row.get("jobDescription") or row.get("description") or ""),
            )
            blob = f"{title} {row.get('jobGeo') or ''} {desc[:400]}"
            if not _query_match(title, blob, queries):
                continue
            seen.add(href)
            result.jobs.append(
                Job(
                    title=title[:180],
                    company=str(row.get("companyName") or row.get("company") or "unspecified")[:120],
                    url=href,
                    portal=portal["id"],
                    location=str(row.get("jobGeo") or row.get("location") or "Remote"),
                    summary=desc[:400],
                    source_method="jobicy_api",
                    query=query,
                    posted_at=str(row.get("pubDate") or row.get("publishedDate") or ""),
                )
            )
    return result


def scrape_himalayas(client: PoliteClient, portal: dict[str, Any], queries: list[str]) -> PortalResult:
    result = PortalResult(portal["id"], portal["name"], "himalayas_api")
    templates = portal.get("search_urls") or [
        "https://himalayas.app/jobs/api?limit=40&q={query_plus}"
    ]
    seen: set[str] = set()
    for query in queries[:2]:
        url = fill_url(templates[0], query)
        result.fetched_urls.append(url)
        status, data = client.get_json(url)
        if status != 200:
            result.error = f"Himalayas HTTP {status}"
            continue
        rows: list[Any]
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = list(data.get("jobs") or [])
        else:
            rows = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = str(row.get("title") or row.get("name") or "")
            href = str(row.get("applicationLink") or row.get("url") or "")
            if not href and row.get("slug"):
                href = f"https://himalayas.app/jobs/{row['slug']}"
            if href and not href.startswith("http") and row.get("slug"):
                href = f"https://himalayas.app/jobs/{row['slug']}"
            if not title or not href.startswith("http") or href in seen:
                continue
            company = row.get("companyName")
            if not company and isinstance(row.get("company"), dict):
                company = (row.get("company") or {}).get("name")
            desc = re.sub(r"<[^>]+>", " ", str(row.get("description") or row.get("excerpt") or ""))
            blob = f"{title} {row.get('location') or ''} {desc[:400]}"
            if not _query_match(title, blob, queries):
                continue
            seen.add(href)
            pub = row.get("pubDate") or row.get("published_at") or ""
            result.jobs.append(
                Job(
                    title=title[:180],
                    company=str(company or "unspecified")[:120],
                    url=href,
                    portal=portal["id"],
                    location=str(row.get("location") or row.get("jobLocation") or "Remote"),
                    summary=desc[:400],
                    source_method="himalayas_api",
                    query=query,
                    posted_at=str(pub),
                )
            )
    return result


def scrape_themuse(
    client: PoliteClient,
    portal: dict[str, Any],
    queries: list[str],
    *,
    locations: list[str],
) -> PortalResult:
    """The Muse public jobs API — reputable curated tech/professional roles."""
    result = PortalResult(portal["id"], portal["name"], "themuse_api")
    seen: set[str] = set()
    loc = (locations[0] if locations else "").replace("(target)", "").strip()
    for query in queries[:2]:
        params = f"page=1&descending=true"
        # The Muse filters by location; keyword matching done client-side
        url = f"https://www.themuse.com/api/public/jobs?{params}"
        if loc:
            url += f"&location={quote_plus(loc)}"
        result.fetched_urls.append(url)
        status, data = client.get_json(url)
        if status != 200 or not isinstance(data, dict):
            result.error = f"The Muse HTTP {status}"
            continue
        for row in data.get("results") or []:
            if not isinstance(row, dict):
                continue
            title = str(row.get("name") or "")
            refs = row.get("refs") or {}
            href = str((refs.get("landing_page") if isinstance(refs, dict) else "") or "")
            if not title or not href or href in seen:
                continue
            company_obj = row.get("company") if isinstance(row.get("company"), dict) else {}
            company = str((company_obj or {}).get("name") or "unspecified")
            locs = row.get("locations") if isinstance(row.get("locations"), list) else []
            loc_str = ", ".join(
                str(x.get("name") or "") for x in locs if isinstance(x, dict) and x.get("name")
            )
            contents = re.sub(r"<[^>]+>", " ", str(row.get("contents") or ""))
            blob = f"{title} {company} {loc_str} {contents[:500]}"
            if not _query_match(title, blob, [query, *queries]):
                continue
            seen.add(href)
            pub = str(row.get("publication_date") or "")[:10]
            result.jobs.append(
                Job(
                    title=title[:180],
                    company=company[:120],
                    url=href,
                    portal=portal["id"],
                    location=loc_str or loc or "Remote",
                    summary=contents[:400],
                    source_method="themuse_api",
                    query=query,
                    posted_at=pub,
                )
            )
            if len(result.jobs) >= 50:
                return result
    return result


def scrape_usajobs(
    client: PoliteClient,
    portal: dict[str, Any],
    queries: list[str],
    *,
    locations: list[str],
    profile: dict[str, Any],
) -> PortalResult:
    """USAJobs.gov official API — US federal roles (requires Authorization-Key for best results)."""
    import os

    result = PortalResult(portal["id"], portal["name"], "usajobs_api")
    region = str((profile.get("geo") or {}).get("region") or "").lower()
    country = str((profile.get("geo") or {}).get("country_indeed") or "").lower()
    if region not in {"usa", "washington", "remote", "worldwide", ""} and country not in {
        "usa",
        "us",
        "",
    }:
        result.skipped = f"USAJobs skipped for region={region or country or 'n/a'}"
        return result

    loc = (locations[0] if locations else "").replace("(target)", "").strip()
    headers = {
        "Host": "data.usajobs.gov",
        "User-Agent": os.environ.get("USAJOBS_USER_AGENT") or "jobhunter@alfredterminal.xyz",
    }
    if os.environ.get("USAJOBS_API_KEY"):
        headers["Authorization-Key"] = os.environ["USAJOBS_API_KEY"]

    seen: set[str] = set()
    for query in queries[:2]:
        from urllib.parse import urlencode

        params: dict[str, str] = {
            "Keyword": query,
            "DatePosted": "14",
            "ResultsPerPage": "40",
        }
        if loc:
            params["LocationName"] = loc
        url = f"https://data.usajobs.gov/api/search?{urlencode(params)}"
        result.fetched_urls.append(url)
        resp = client.get(url, headers=headers)
        status = resp.status_code
        try:
            data = resp.json()
        except Exception:  # noqa: BLE001
            data = None
        if status != 200 or not isinstance(data, dict):
            result.error = f"USAJobs HTTP {status}"
            continue
        items = ((data.get("SearchResult") or {}).get("SearchResultItems")) or []
        for row in items:
            if not isinstance(row, dict):
                continue
            matched = row.get("MatchedObjectDescriptor") or {}
            if not isinstance(matched, dict):
                continue
            title = str(matched.get("PositionTitle") or "")
            apply_list = matched.get("ApplyURI") if isinstance(matched.get("ApplyURI"), list) else []
            apply = str((apply_list[0] if apply_list else "") or matched.get("PositionURI") or "")
            if not title or not apply or apply in seen:
                continue
            seen.add(apply)
            org = str(matched.get("OrganizationName") or "USAJobs")
            locs = matched.get("PositionLocation") if isinstance(matched.get("PositionLocation"), list) else []
            loc_str = ", ".join(
                str(x.get("LocationName") or "")
                for x in locs
                if isinstance(x, dict) and x.get("LocationName")
            )
            user_area = matched.get("UserArea") if isinstance(matched.get("UserArea"), dict) else {}
            details = user_area.get("Details") if isinstance(user_area.get("Details"), dict) else {}
            summary_raw = details.get("JobSummary") or matched.get("QualificationSummary") or ""
            pub = str(matched.get("PublicationStartDate") or "")[:10]
            result.jobs.append(
                Job(
                    title=title[:180],
                    company=org[:120],
                    url=apply,
                    portal=portal["id"],
                    location=loc_str or loc or "United States",
                    summary=re.sub(r"<[^>]+>", " ", str(summary_raw))[:400],
                    source_method="usajobs_api",
                    query=query,
                    posted_at=pub,
                )
            )
    return result


def scrape_rss(client: PoliteClient, portal: dict[str, Any], queries: list[str]) -> PortalResult:
    result = PortalResult(portal["id"], portal["name"], "rss")
    needles = [q.lower() for q in queries]
    for template in portal.get("search_urls") or []:
        url = fill_url(template, needles[0] if needles else "network")
        result.fetched_urls.append(url)
        status, text = client.get_text(url)
        if status != 200:
            result.error = f"RSS HTTP {status} for {url}"
            continue
        parsed = feedparser.parse(text)
        for entry in parsed.entries:
            title = str(entry.get("title") or "")
            link = str(entry.get("link") or "")
            summary = str(entry.get("summary") or entry.get("description") or "")
            if needles and not any(n in title.lower() for n in needles) and not REMOTE_TAGS.search(title):
                continue
            if not title or not link:
                continue
            published = str(entry.get("published") or entry.get("updated") or "")
            if not published and entry.get("published_parsed"):
                try:
                    from time import strftime

                    published = strftime("%Y-%m-%d", entry.published_parsed)
                except Exception:  # noqa: BLE001
                    published = ""
            result.jobs.append(
                Job(
                    title=title[:180],
                    company=_company_from_host(link),
                    url=link,
                    portal=portal["id"],
                    summary=re.sub(r"<[^>]+>", " ", summary)[:400],
                    source_method="rss",
                    query="rss",
                    posted_at=published,
                )
            )
    return result


def scrape_html(
    client: PoliteClient,
    portal: dict[str, Any],
    queries: list[str],
    *,
    max_jobs: int,
    locations: list[str] | None = None,
) -> PortalResult:
    result = PortalResult(portal["id"], portal["name"], "html")
    hints = list(portal.get("job_path_hints") or [])
    locs = locations or []
    seen: set[str] = set()
    for query in queries:
        for template in portal.get("search_urls") or []:
            url = fill_url(template, query, location=(locs[0] if locs else ""))
            result.fetched_urls.append(url)
            try:
                status, html = client.get_text(url)
            except Exception as exc:  # noqa: BLE001
                result.error = str(exc)
                continue
            if status >= 400:
                result.error = f"HTTP {status} for {url}"
                continue
            found = extract_html_jobs(
                html,
                portal=portal["id"],
                query=query,
                page_url=url,
                job_path_hints=hints,
                max_jobs=max_jobs,
            )
            for job in found:
                if job.url in seen:
                    continue
                seen.add(job.url)
                result.jobs.append(job)
            if len(result.jobs) >= max_jobs:
                return result
    return result


def scrape_site_search(
    portal: dict[str, Any],
    queries: list[str],
    *,
    api_key: str,
    delay: float,
    locations: list[str],
) -> PortalResult:
    result = PortalResult(portal["id"], portal["name"], "site_search")
    host = portal.get("host") or ""
    seen: set[str] = set()
    loc = " ".join(locations[:2]) if locations else "remote"
    for query in queries:
        q = f'{query} {loc} site:{host}'
        result.fetched_urls.append(q)
        try:
            hits = firecrawl_search(q, api_key=api_key, limit=8, include_domains=[host] if host else None)
        except Exception as exc:  # noqa: BLE001
            result.error = str(exc)
            polite_pause(delay)
            continue
        for job in _from_search_hits(hits, portal=portal["id"], query=query, method="site_search"):
            if job.url in seen:
                continue
            seen.add(job.url)
            result.jobs.append(job)
        polite_pause(delay)
    return result


def maybe_firecrawl_html_fallback(
    portal: dict[str, Any],
    queries: list[str],
    *,
    api_key: str,
    max_jobs: int,
    locations: list[str] | None = None,
) -> list[Job]:
    jobs: list[Job] = []
    seen: set[str] = set()
    locs = locations or []
    for query in queries[:1]:
        for template in (portal.get("search_urls") or [])[:1]:
            url = fill_url(template, query, location=(locs[0] if locs else ""))
            try:
                md = firecrawl_scrape_markdown(url, api_key=api_key)
            except Exception:
                continue
            for job in extract_markdown_jobs(
                md, portal=portal["id"], query=query, page_url=url, max_jobs=max_jobs
            ):
                if job.url in seen:
                    continue
                seen.add(job.url)
                jobs.append(job)
    return jobs
