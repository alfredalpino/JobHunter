from __future__ import annotations

import csv
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml

from adapters import (
    maybe_firecrawl_html_fallback,
    scrape_arbeitnow,
    scrape_html,
    scrape_himalayas,
    scrape_jobicy,
    scrape_remotive,
    scrape_remoteok,
    scrape_rss,
    scrape_site_search,
    scrape_themuse,
    scrape_usajobs,
)
from jobspy_adapter import scrape_jobspy
from eligibility import score_job
from firecrawl_client import load_firecrawl_key
from http_client import PoliteClient
from models import Job, PortalResult
from profile_builder import load_aspirant, load_defaults
from scrape_cache import ScrapeCache

ROOT = Path(__file__).resolve().parents[1]

FAST_METHODS = frozenset(
    {
        "remoteok_api",
        "remotive_api",
        "rss",
        "arbeitnow_api",
        "jobicy_api",
        "himalayas_api",
        "themuse_api",
        "usajobs_api",
    }
)


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def run_hunt(
    *,
    aspirant_id: str,
    quick: bool = False,
    use_firecrawl: bool = True,
    query_limit: int | None = None,
    portal_ids: list[str] | None = None,
) -> dict[str, Any]:
    profile = load_aspirant(aspirant_id)
    defaults = load_defaults()
    # Ensure recency always present from defaults
    if not profile.get("recency"):
        profile["recency"] = defaults.get("recency") or {}
    if not profile.get("scoring"):
        profile["scoring"] = defaults.get("scoring") or {}
    if not profile.get("geo"):
        profile["geo"] = defaults.get("geo") or {}

    portals_cfg = load_yaml(ROOT / "config" / "portals.yaml")
    scrape_defaults = defaults.get("scraping") or portals_cfg.get("defaults") or {}
    queries = list(profile.get("search_queries") or portals_cfg.get("queries") or ["network engineer"])
    if query_limit:
        queries = queries[:query_limit]
    if quick:
        queries = queries[:1]
    locations = list(
        (profile.get("geo") or {}).get("default_locations")
        or portals_cfg.get("locations")
        or ["Remote"]
    )
    delay = float(scrape_defaults.get("delay_seconds") or 1.8)
    timeout = float(scrape_defaults.get("timeout_seconds") or 25)
    max_jobs = int(scrape_defaults.get("max_jobs_per_portal") or 40)
    ua = str(scrape_defaults.get("user_agent") or "JobHunter/1.0")
    fast_workers = int(scrape_defaults.get("fast_concurrency") or 6)
    slow_workers = int(scrape_defaults.get("slow_concurrency") or 3)
    cache_ttl = int(scrape_defaults.get("cache_ttl_seconds") or 3600)
    http_retries = int(scrape_defaults.get("http_retries") or 2)
    api_key = load_firecrawl_key(ROOT) if use_firecrawl else ""

    cache: ScrapeCache | None = None
    if cache_ttl > 0:
        cache = ScrapeCache(ROOT / "data" / "cache" / "scrapes", ttl_seconds=cache_ttl)

    client = PoliteClient(
        user_agent=ua,
        timeout=timeout,
        delay=delay,
        retries=http_retries,
        cache=cache,
    )
    results: list[PortalResult] = []
    try:
        selected_region = str((profile.get("geo") or {}).get("region") or "").lower()
        uae_regions = {"", "dubai", "uae"}
        work: list[dict[str, Any]] = []

        for portal in portals_cfg.get("portals") or []:
            if portal_ids and portal["id"] not in portal_ids:
                continue
            method = portal.get("method") or "html"
            if method == "skip":
                results.append(
                    PortalResult(
                        portal["id"],
                        portal["name"],
                        "skip",
                        skipped=portal.get("note") or "not a public job board",
                    )
                )
                continue
            portal_regions = [str(r).lower() for r in (portal.get("regions") or [])]
            if selected_region and selected_region not in uae_regions and selected_region not in {
                "remote",
                "worldwide",
            }:
                if not portal_regions:
                    if method not in FAST_METHODS | {"jobspy"}:
                        results.append(
                            PortalResult(
                                portal["id"],
                                portal["name"],
                                "skip",
                                skipped=f"UAE-centric board skipped for region={selected_region}",
                            )
                        )
                        continue
                elif selected_region not in portal_regions and "worldwide" not in portal_regions:
                    results.append(
                        PortalResult(
                            portal["id"],
                            portal["name"],
                            "skip",
                            skipped=f"region mismatch ({selected_region} vs {portal_regions})",
                        )
                    )
                    continue
            if quick and method not in FAST_METHODS:
                continue
            work.append(portal)

        fast_portals = [p for p in work if (p.get("method") or "html") in FAST_METHODS]
        slow_portals = [p for p in work if (p.get("method") or "html") not in FAST_METHODS]

        def _scrape_portal(portal: dict[str, Any]) -> PortalResult:
            method = portal.get("method") or "html"
            print(f"→ {portal['name']} [{method}]")
            try:
                result = _dispatch(
                    client,
                    portal,
                    queries,
                    method=method,
                    max_jobs=max_jobs,
                    api_key=api_key,
                    delay=delay,
                    locations=locations,
                    profile=profile,
                )
                if (
                    not result.jobs
                    and api_key
                    and method == "html"
                    and portal.get("fallback") == "site_search"
                ):
                    print(f"  {portal['name']}: html empty — Firecrawl site search fallback")
                    fb = scrape_site_search(
                        portal,
                        queries[:1],
                        api_key=api_key,
                        delay=delay,
                        locations=locations,
                    )
                    if fb.jobs:
                        result.jobs = fb.jobs
                        result.method = "html+site_search"
                    elif portal.get("js_heavy"):
                        result.jobs = maybe_firecrawl_html_fallback(
                            portal,
                            queries,
                            api_key=api_key,
                            max_jobs=max_jobs,
                            locations=locations,
                        )
                note = f" ({result.error})" if result.error else ""
                print(f"  {portal['name']}: {len(result.jobs)} listings{note}")
                return result
            except Exception as exc:  # noqa: BLE001
                print(f"  {portal['name']}: ! {exc}")
                return PortalResult(portal["id"], portal["name"], method, error=str(exc))

        def _run_tier(portals: list[dict[str, Any]], workers: int, label: str) -> None:
            if not portals:
                return
            n = max(1, min(workers, len(portals)))
            print(f"⋯ {label}: {len(portals)} portals, concurrency={n}")
            with ThreadPoolExecutor(max_workers=n) as pool:
                futures = [pool.submit(_scrape_portal, p) for p in portals]
                for fut in as_completed(futures):
                    results.append(fut.result())

        _run_tier(fast_portals, fast_workers, "fast tier (API/RSS)")
        _run_tier(slow_portals, slow_workers, "slow tier (HTML/site_search)")

        # Major worldwide boards (Indeed / LinkedIn / Google Jobs / …) via optional JobSpy
        hunt = profile.get("hunt") or {}
        use_jobspy = bool(hunt.get("use_jobspy", True))
        jobspy_allowed = not portal_ids or "jobspy" in portal_ids
        if use_jobspy and jobspy_allowed and not quick:
            sites = list(hunt.get("jobspy_sites") or ["indeed", "linkedin", "google"])
            country = str((profile.get("geo") or {}).get("country_indeed") or "")
            work_mode = str((profile.get("geo") or {}).get("work_mode") or "any").lower()
            is_remote = True if work_mode == "remote" else None
            print(f"→ JobSpy major boards [{', '.join(sites)}]")
            try:
                js_result = scrape_jobspy(
                    queries=queries,
                    locations=locations,
                    sites=sites,
                    country_indeed=country,
                    hours_old=int((profile.get("recency") or {}).get("max_age_days") or 14) * 24,
                    results_wanted=min(max_jobs, 25),
                    is_remote=is_remote,
                )
                results.append(js_result)
                note = f" ({js_result.error})" if js_result.error else ""
                skip = f" [{js_result.skipped}]" if js_result.skipped else ""
                print(f"  {len(js_result.jobs)} listings{note}{skip}")
            except Exception as exc:  # noqa: BLE001
                results.append(PortalResult("jobspy", "JobSpy major boards", "jobspy", error=str(exc)))
                print(f"  ! {exc}")
    finally:
        client.close()

    if cache is not None:
        print(f"⋯ scrape cache {cache.stats()}")

    raw_jobs: list[Job] = []
    seen: set[str] = set()
    for result in results:
        for job in result.jobs:
            key = _dedupe_key(job)
            if key in seen:
                continue
            seen.add(key)
            raw_jobs.append(score_job(job, profile))

    eligible = sorted([j for j in raw_jobs if j.eligible], key=lambda j: j.score, reverse=True)
    week1 = [j for j in eligible if j.recency_bucket == "last_7_days"]
    week2 = [j for j in eligible if j.recency_bucket == "days_8_to_14"]
    rejected = [j for j in raw_jobs if not j.eligible]
    name = (profile.get("candidate") or {}).get("name") or aspirant_id

    payload = {
        "swept_at": date.today().isoformat(),
        "aspirant_id": aspirant_id,
        "aspirant_name": name,
        "quick": quick,
        "query_count": len(queries),
        "queries": queries,
        "recency_rule": "posted within last 14 days only; unknown dates rejected",
        "portal_count": len(results),
        "raw_count": len(raw_jobs),
        "eligible_count": len(eligible),
        "last_7_days_count": len(week1),
        "days_8_to_14_count": len(week2),
        "rejected_count": len(rejected),
        "portals": [
            {
                "id": r.portal_id,
                "name": r.name,
                "method": r.method,
                "jobs": len(r.jobs),
                "error": r.error,
                "skipped": r.skipped,
            }
            for r in results
        ],
        "eligible": [j.to_dict() for j in eligible],
        "last_7_days": [j.to_dict() for j in week1],
        "days_8_to_14": [j.to_dict() for j in week2],
        "rejected": [j.to_dict() for j in rejected],
    }
    _write_exports(payload, eligible, week1, week2, aspirant_id)
    return payload


def _dispatch(
    client: PoliteClient,
    portal: dict[str, Any],
    queries: list[str],
    *,
    method: str,
    max_jobs: int,
    api_key: str,
    delay: float,
    locations: list[str],
    profile: dict[str, Any] | None = None,
) -> PortalResult:
    if method == "remoteok_api":
        return scrape_remoteok(client, portal, queries)
    if method == "remotive_api":
        return scrape_remotive(client, portal, queries)
    if method == "arbeitnow_api":
        return scrape_arbeitnow(client, portal, queries)
    if method == "jobicy_api":
        return scrape_jobicy(client, portal, queries)
    if method == "himalayas_api":
        return scrape_himalayas(client, portal, queries)
    if method == "themuse_api":
        return scrape_themuse(client, portal, queries, locations=locations)
    if method == "usajobs_api":
        return scrape_usajobs(client, portal, queries, locations=locations, profile=profile or {})
    if method == "rss":
        return scrape_rss(client, portal, queries)
    if method == "site_search":
        if not api_key:
            return PortalResult(
                portal["id"],
                portal["name"],
                method,
                error="FIRECRAWL_API_KEY missing — set JobHunter/.env",
            )
        return scrape_site_search(
            portal, queries, api_key=api_key, delay=delay, locations=locations
        )
    return scrape_html(client, portal, queries, max_jobs=max_jobs, locations=locations)


def _dedupe_key(job: Job) -> str:
    host = urlparse(job.url).netloc.lower().removeprefix("www.")
    title = " ".join(job.title.lower().split())
    company = " ".join(job.company.lower().split())
    return f"{host}|{title}|{company}"


def _write_exports(
    payload: dict[str, Any],
    eligible: list[Job],
    week1: list[Job],
    week2: list[Job],
    aspirant_id: str,
) -> None:
    out_dir = ROOT / "data" / "exports" / aspirant_id
    raw_dir = ROOT / "data" / "raw" / aspirant_id
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)
    (raw_dir / "latest.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    csv_path = out_dir / f"eligible-{payload['swept_at']}.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "score",
                "posted_age_days",
                "recency_bucket",
                "title",
                "company",
                "location",
                "portal",
                "url",
                "query",
                "summary",
            ],
        )
        writer.writeheader()
        for job in eligible:
            writer.writerow(
                {
                    "score": job.score,
                    "posted_age_days": job.posted_age_days,
                    "recency_bucket": job.recency_bucket,
                    "title": job.title,
                    "company": job.company,
                    "location": job.location,
                    "portal": job.portal,
                    "url": job.url,
                    "query": job.query,
                    "summary": job.summary,
                }
            )

    name = payload.get("aspirant_name") or aspirant_id
    lines = [
        f"# JobHunter — {name}",
        "",
        f"- Swept: **{payload['swept_at']}**",
        f"- Recency rule: **only postings ≤ 14 days old** (unknown dates rejected)",
        f"- Portals contacted: **{payload['portal_count']}**",
        f"- Listings before filters: **{payload['raw_count']}**",
        f"- Eligible (skill + geo + ≤14d): **{payload['eligible_count']}**",
        f"- Last 7 days: **{payload['last_7_days_count']}** · 8–14 days: **{payload['days_8_to_14_count']}**",
        "",
        "## Eligible roles",
        "",
        "| Score | Age | Title | Company | Portal | Apply |",
        "| ---: | ---: | --- | --- | --- | --- |",
    ]
    for job in eligible[:100]:
        age = "—" if job.posted_age_days is None else f"{job.posted_age_days}d"
        lines.append(
            f"| {job.score} | {age} | {job.title.replace('|', '/')} | "
            f"{job.company.replace('|', '/')} | {job.portal} | [open]({job.url}) |"
        )
    if not eligible:
        lines.append("| — | — | No eligible fresh roles this run | — | — | — |")

    # Bottom section — week buckets as requested
    lines.extend(
        [
            "",
            "---",
            "",
            "## Posted in the last 7 days",
            "",
            "| Score | Age | Title | Company | Portal | Apply |",
            "| ---: | ---: | --- | --- | --- | --- |",
        ]
    )
    if week1:
        for job in week1:
            lines.append(
                f"| {job.score} | {job.posted_age_days}d | {job.title.replace('|', '/')} | "
                f"{job.company.replace('|', '/')} | {job.portal} | [open]({job.url}) |"
            )
    else:
        lines.append("| — | — | None in the last 7 days | — | — | — |")

    lines.extend(
        [
            "",
            "## Posted 8–14 days ago",
            "",
            "| Score | Age | Title | Company | Portal | Apply |",
            "| ---: | ---: | --- | --- | --- | --- |",
        ]
    )
    if week2:
        for job in week2:
            lines.append(
                f"| {job.score} | {job.posted_age_days}d | {job.title.replace('|', '/')} | "
                f"{job.company.replace('|', '/')} | {job.portal} | [open]({job.url}) |"
            )
    else:
        lines.append("| — | — | None in the 8–14 day window | — | — | — |")

    lines.extend(
        [
            "",
            "## Portal status",
            "",
            "| Portal | Method | Listings | Notes |",
            "| --- | --- | ---: | --- |",
        ]
    )
    by_status: dict[str, int] = defaultdict(int)
    for row in payload["portals"]:
        note = row.get("skipped") or row.get("error") or ""
        by_status[row["method"]] += 1
        lines.append(f"| {row['name']} | {row['method']} | {row['jobs']} | {note} |")

    md_path = out_dir / "eligible.md"
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    # Convenience copy at exports root for latest aspirant run
    (ROOT / "data" / "exports" / "eligible.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
    print(f"Wrote {csv_path}")
    print(f"Wrote {md_path}")
    print(f"Methods used: {dict(by_status)}")
