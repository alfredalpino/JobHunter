from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Job:
    title: str
    company: str
    url: str
    portal: str
    location: str = ""
    summary: str = ""
    source_method: str = ""
    query: str = ""
    posted_at: str = ""
    posted_age_days: int | None = None
    recency_bucket: str = ""  # last_7_days | days_8_to_14 | stale | unknown
    score: int = 0
    reject_reason: str = ""
    eligible: bool = False

    def blob(self) -> str:
        return " ".join(
            [
                self.title,
                self.company,
                self.location,
                self.summary,
                self.posted_at,
                self.url,
            ]
        ).lower()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class PortalResult:
    portal_id: str
    name: str
    method: str
    jobs: list[Job] = field(default_factory=list)
    error: str = ""
    skipped: str = ""
    fetched_urls: list[str] = field(default_factory=list)
