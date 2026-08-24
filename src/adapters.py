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
