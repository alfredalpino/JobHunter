from __future__ import annotations

import json
import re
from html import unescape
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from models import Job

JOB_HREF = re.compile(
    r"(jk=|/viewjob|/job[s]?/|/jdp/|/career[s]?/|/vacanc|/opening|/position|/ad/|/view/|/j/)",
    re.I,
)
NOISE_HREF = re.compile(
    r"(login|signup|register|privacy|terms|cookie|about|contact|blog|help|faq|"
    r"facebook|twitter|instagram|linkedin\.com/company|javascript:|#)",
    re.I,
)


def _text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return str(value.get("name") or value.get("value") or "")
    if isinstance(value, list):
        return ", ".join(_text(v) for v in value if v)
    return unescape(str(value)).strip()


def _clean_url(url: str, base: str) -> str:
    abs_url = urljoin(base, url.split("#")[0].strip())
    parsed = urlparse(abs_url)
    if parsed.scheme not in {"http", "https"}:
        return ""
    return abs_url


def extract_json_ld_jobs(html: str, *, portal: str, query: str, page_url: str) -> list[Job]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[Job] = []
    for tag in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        raw = tag.string or tag.get_text() or ""
        raw = raw.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        for node in _walk(data):
            types = node.get("@type")
            type_blob = " ".join(types) if isinstance(types, list) else str(types or "")
            if "JobPosting" not in type_blob:
                continue
            title = _text(node.get("title") or node.get("name"))
            url = _text(node.get("url") or node.get("@id")) or page_url
            org = node.get("hiringOrganization") or {}
            company = _text(org) if not isinstance(org, dict) else _text(org.get("name"))
            loc = node.get("jobLocation") or {}
            location = ""
            if isinstance(loc, list) and loc:
                loc = loc[0]
            if isinstance(loc, dict):
                addr = loc.get("address") or loc
                if isinstance(addr, dict):
                    location = _text(
                        addr.get("addressLocality")
                        or addr.get("addressRegion")
                        or addr.get("addressCountry")
                    )
                else:
                    location = _text(addr)
            else:
                location = _text(loc)
            summary = _text(node.get("description"))[:500]
            if title:
                jobs.append(
                    Job(
                        title=title[:180],
                        company=company or "unspecified",
                        url=_clean_url(url, page_url) or page_url,
                        portal=portal,
                        location=location,
                        summary=re.sub(r"<[^>]+>", " ", summary),
                        source_method="jsonld",
                        query=query,
                    )
                )
    return jobs


def _walk(data: object) -> list[dict]:
    out: list[dict] = []
    if isinstance(data, dict):
        out.append(data)
        graph = data.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                out.extend(_walk(item))
        elif graph:
            out.extend(_walk(graph))
    elif isinstance(data, list):
        for item in data:
            out.extend(_walk(item))
    return [n for n in out if isinstance(n, dict)]


def extract_html_jobs(
    html: str,
    *,
    portal: str,
    query: str,
    page_url: str,
    job_path_hints: list[str] | None = None,
    max_jobs: int = 40,
) -> list[Job]:
    jobs = extract_json_ld_jobs(html, portal=portal, query=query, page_url=page_url)
    seen = {j.url for j in jobs}
    soup = BeautifulSoup(html, "lxml")
    hints = [h.lower() for h in (job_path_hints or [])]

    for a in soup.find_all("a", href=True):
        href = a.get("href") or ""
        url = _clean_url(href, page_url)
        if not url or url in seen:
            continue
        low = url.lower()
        if NOISE_HREF.search(low) or NOISE_HREF.search(href):
            continue
        hinted = any(h in low for h in hints) if hints else False
        if not hinted and not JOB_HREF.search(low):
            continue
        title = " ".join(a.get_text(" ", strip=True).split())
        if len(title) < 4 or len(title) > 160:
            continue
        if title.lower() in {"jobs", "view job", "apply", "read more", "see more", "learn more"}:
            continue
        company = ""
        parent = a.find_parent(["article", "li", "div"])
        if parent:
            blob = " ".join(parent.get_text(" ", strip=True).split())
            summary = blob[:400]
        else:
            summary = title
        jobs.append(
            Job(
                title=title,
                company=company or "unspecified",
                url=url,
                portal=portal,
                summary=summary,
                source_method="html",
                query=query,
            )
        )
        seen.add(url)
        if len(jobs) >= max_jobs:
            break
    return jobs


def extract_markdown_jobs(
    markdown: str,
    *,
    portal: str,
    query: str,
    page_url: str,
    max_jobs: int = 40,
) -> list[Job]:
    jobs: list[Job] = []
    seen: set[str] = set()
    for title, href in re.findall(r"\[([^\]]{4,160})\]\((https?://[^)\s]+)\)", markdown):
        url = href.split("#")[0]
        if url in seen or NOISE_HREF.search(url):
            continue
        if not JOB_HREF.search(url) and "indeed.com" not in url:
            continue
        clean_title = " ".join(unescape(title).split())
        if clean_title.lower() in {"jobs", "view job", "apply"}:
            continue
        jobs.append(
            Job(
                title=clean_title,
                company="unspecified",
                url=url,
                portal=portal,
                summary=clean_title,
                source_method="markdown",
                query=query,
            )
        )
        seen.add(url)
        if len(jobs) >= max_jobs:
            break
    if not jobs and page_url:
        # Keep parser usable even when markdown has no links.
        return jobs
    return jobs
