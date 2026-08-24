"""Optional JobSpy adapter for worldwide major boards (soft dependency)."""
from __future__ import annotations

from typing import Any

from models import Job, PortalResult

# Map JobSpy site → display label
SITE_LABEL = {
    "indeed": "Indeed",
    "linkedin": "LinkedIn",
    "glassdoor": "Glassdoor",
    "google": "Google Jobs",
    "zip_recruiter": "ZipRecruiter",
    "bayt": "Bayt",
    "naukri": "Naukri",
    "bdjobs": "Bdjobs",
}

# JobSpy expects full country names for Indeed/Glassdoor (not ISO-ish shortcuts).
COUNTRY_ALIASES = {
    "uae": "united arab emirates",
    "ae": "united arab emirates",
    "dubai": "united arab emirates",
    "usa": "usa",
    "us": "usa",
    "uk": "uk",
    "gb": "uk",
    "india": "india",
    "in": "india",
    "canada": "canada",
    "ca": "canada",
    "poland": "poland",
    "pl": "poland",
    "saudi": "saudi arabia",
    "ksa": "saudi arabia",
}


def _normalize_country(country: str) -> str:
    raw = (country or "").strip().lower()
    if not raw:
        return ""
    return COUNTRY_ALIASES.get(raw, raw)


def jobspy_available() -> bool:
    try:
        import jobspy  # noqa: F401
        return True
    except Exception:
        return False


def scrape_jobspy(
    *,
    queries: list[str],
    locations: list[str],
    sites: list[str],
    country_indeed: str = "",
    hours_old: int = 336,
    results_wanted: int = 25,
    is_remote: bool | None = None,
) -> PortalResult:
    """Scrape major boards via python-jobspy. hours_old=336 ≈ 14 days."""
    result = PortalResult("jobspy", "JobSpy major boards", "jobspy")
    if not jobspy_available():
        result.error = "python-jobspy not installed — pip install python-jobspy"
        result.skipped = result.error
        return result

    from jobspy import scrape_jobs

    location = ", ".join(locations[:2]) if locations else ""
    site_names = [s for s in sites if s]
    if not site_names:
        site_names = ["indeed", "linkedin", "google", "glassdoor"]
    country = _normalize_country(country_indeed)

    all_jobs: list[Job] = []
    seen: set[str] = set()
    last_error = ""
    for query in queries[:3]:
        try:
            kwargs: dict[str, Any] = {
                "site_name": site_names,
                "search_term": query,
                "location": location,
                "results_wanted": results_wanted,
                "hours_old": hours_old,
                "verbose": 0,
            }
            if country:
                kwargs["country_indeed"] = country
            if is_remote is True:
                kwargs["is_remote"] = True
            # Google Jobs benefits from a richer natural-language term
            if "google" in site_names and location:
                kwargs["google_search_term"] = f"{query} jobs near {location} since last week"

            df = scrape_jobs(**kwargs)

            # Google sometimes returns empty on the first cursor; retry with a simpler term
            google_hit = False
            if df is not None and not getattr(df, "empty", True) and "site" in getattr(df, "columns", []):
                google_hit = any(str(s).lower() == "google" for s in df["site"].tolist())
            if "google" in site_names and location and not google_hit:
                try:
                    gdf = scrape_jobs(
                        site_name=["google"],
                        search_term=query,
                        google_search_term=f"{query} jobs in {location}",
                        location=location,
                        results_wanted=results_wanted,
                        verbose=0,
                    )
                    if gdf is not None and not getattr(gdf, "empty", True):
                        if df is None or getattr(df, "empty", True):
                            df = gdf
                        else:
                            import pandas as pd

                            df = pd.concat([df, gdf], ignore_index=True)
                except Exception:  # noqa: BLE001
                    pass
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            result.error = last_error
            continue

        if df is None or getattr(df, "empty", True):
            continue
        for _, row in df.iterrows():
            url = str(row.get("job_url") or row.get("job_url_direct") or "").strip()
            title = str(row.get("title") or "").strip()
            if not url or not title or url in seen:
                continue
            seen.add(url)
            site = str(row.get("site") or "jobspy").lower()
            posted = row.get("date_posted")
            posted_s = ""
            if posted is not None and str(posted) not in {"", "NaT", "None", "nan"}:
                posted_s = str(posted)[:10]
            loc_parts = []
            for key in ("location", "city", "state", "country"):
                val = row.get(key)
                if val is not None and str(val) not in {"", "nan", "None"}:
                    loc_parts.append(str(val))
            loc = ", ".join(dict.fromkeys(loc_parts)) if loc_parts else location
            all_jobs.append(
                Job(
                    title=title[:180],
                    company=str(row.get("company") or "unspecified")[:120],
                    url=url,
                    portal=f"jobspy:{site}",
                    location=loc[:120],
                    summary=str(row.get("description") or title)[:400],
                    posted_at=posted_s,
                    source_method="jobspy",
                    query=query,
                )
            )
    result.jobs = all_jobs
    result.fetched_urls.append(f"jobspy:{','.join(site_names)}@{location}")
    if not all_jobs and last_error:
        result.error = last_error
    return result
