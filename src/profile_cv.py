"""Extract eligibility signals from a CV/resume PDF or text."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

CERT_PATTERNS = [
    (r"\bccna\b", "CCNA"),
    (r"\bccnp\b", "CCNP"),
    (r"\bcomptia\s*security\+?", "CompTIA Security+"),
    (r"\bsecurity\+", "CompTIA Security+"),
    (r"\baz[- ]?104\b", "AZ-104"),
    (r"\baws\s+certified\b", "AWS Certified"),
    (r"\bpmp\b", "PMP"),
    (r"\bitil\b", "ITIL"),
    (r"\bgoogle\s+it\s+support\b", "Google IT Support"),
]

SKILL_SEEDS = [
    "network",
    "cisco",
    "ccna",
    "vlan",
    "ospf",
    "firewall",
    "vpn",
    "noc",
    "routing",
    "switching",
    "tcp/ip",
    "dns",
    "dhcp",
    "azure",
    "aws",
    "linux",
    "python",
    "troubleshooting",
    "helpdesk",
    "service desk",
    "it support",
    "security",
    "cloud",
]


def extract_pdf_text(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def extract_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def load_resume_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_pdf_text(path)
    if suffix in {".md", ".txt", ".text"}:
        return extract_text_file(path)
    raise ValueError(f"Unsupported resume format: {suffix} (use PDF, MD, or TXT)")


def analyze_resume_text(text: str) -> dict[str, Any]:
    clean = re.sub(r"[ \t]+", " ", text)
    lines = [ln.strip() for ln in clean.splitlines() if ln.strip()]
    blob = clean.lower()

    name = ""
    for ln in lines[:12]:
        low = ln.lower()
        if re.search(r"@|http|linkedin|github|phone|\+?\d{8,}|summary|experience|education|skills|certification", low):
            continue
        # Strip markdown bold / role suffixes after ·
        candidate = re.split(r"[·|]", ln)[0].strip("#* ").strip()
        if 1 < len(candidate.split()) <= 6 and re.search(r"[A-Za-z]", candidate):
            # Prefer all-caps or Title Case person names
            if candidate.isupper() or candidate.istitle() or re.match(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}$", candidate):
                name = candidate.title() if candidate.isupper() else candidate
                break
            if not name:
                name = candidate

    # "Open to" titles are the hunt targets — prefer over historical job titles
    open_to: list[str] = []
    for m in re.finditer(r"(?i)open to[:\s]+(.+)", text):
        for part in re.split(r"[·|,;/]", m.group(1)):
            part = part.strip(" .-*")
            if 3 < len(part) < 60:
                open_to.append(part)

    titles: list[str] = []
    title_hints = re.findall(
        r"(?im)^(?:#{1,3}\s*)?\*{0,2}([A-Z][A-Za-z0-9 /&+.-]{3,60})\*{0,2}\s*(?:·|-|,|\||$)",
        text,
    )
    for t in title_hints:
        tl = t.lower()
        if any(
            k in tl
            for k in (
                "engineer",
                "analyst",
                "administrator",
                "support",
                "noc",
                "network",
                "developer",
                "specialist",
            )
        ):
            titles.append(t.strip(" *"))

    target_titles = _dedupe(open_to + titles)[:12] or [
        "Network Engineer",
        "NOC Engineer",
        "IT Support Engineer",
    ]
    # Search queries: prefer open-to / network-ish titles, not every past role
    def _hunt_worthy(t: str) -> bool:
        return bool(
            re.search(
                r"network|noc|support engineer|it support|infra|admin|security|"
                r"sysadmin|systems?|cloud|devops|telecom|helpdesk|service desk",
                t,
                re.I,
            )
        ) and not re.search(r"customer support associate|sales|waiter|chef", t, re.I)

    search_seed = [t for t in open_to if _hunt_worthy(t)] or [
        t for t in target_titles if _hunt_worthy(t)
    ] or target_titles[:3]

    email_m = re.search(r"[\w.+-]+@[\w.-]+\.\w+", text)
    phone_m = re.search(r"(\+?\d[\d\s\-()]{8,}\d)", text)
    linkedin_m = re.search(r"(https?://(?:www\.)?linkedin\.com/in/[\w%-]+/?)", text, re.I)

    certs = [label for pat, label in CERT_PATTERNS if re.search(pat, blob)]
    skills = [s for s in SKILL_SEEDS if s in blob]

    years = _estimate_years(blob)
    # Hunt band stays junior-friendly when open-to / junior signals exist
    junior_signal = bool(
        open_to
        or re.search(r"\b(junior|entry[\s-]?level|fresher|associate|intern|noc l1)\b", blob)
    )
    level = "junior_entry_associate" if junior_signal or (years is not None and years <= 3) else "mid_or_unknown"
    max_years_required = 3 if junior_signal or years is None or years <= 3 else min(int(years) + 1, 8)
    target_band = "0-3" if max_years_required <= 3 else f"0-{max_years_required}"

    project_cred = bool(
        re.search(
            r"\b(project|portfolio|github|capstone|built|deployed|open\s*source)\b",
            blob,
        )
    )
    return {
        "source": "resume",
        "candidate": {
            "name": name or "Aspirant",
            "email": email_m.group(0) if email_m else "",
            "phone": phone_m.group(0).strip() if phone_m else "",
            "linkedin": linkedin_m.group(1) if linkedin_m else "",
            "location": _guess_location(blob),
        },
        "experience": {
            "estimated_years": years,
            "max_years_required": max_years_required,
            "level": level,
            "target_band": target_band,
            "credibility": project_cred or bool(certs) or (years is not None and years >= 2),
        },
        "target_titles": target_titles,
        "search_queries": _dedupe(search_seed)[:4],
        "skills_positive": _dedupe(skills + [c.lower() for c in certs]),
        "certifications": certs,
        "title_must_match_any": _title_must_from_skills(skills, target_titles),
        "raw_excerpt": text[:2500],
    }


def _estimate_years(blob: str) -> float | None:
    spans = re.findall(
        r"(20\d{2})\s*[-–—]\s*(20\d{2}|present|current|now)",
        blob,
        re.I,
    )
    if not spans:
        m = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience", blob)
        return float(m.group(1)) if m else None
    total = 0.0
    for start, end in spans:
        y0 = int(start)
        y1 = 2026 if re.search(r"present|current|now", end, re.I) else int(end)
        if y1 >= y0:
            total += max(0, y1 - y0)
    # Rough unique calendar span, not double-counting heavily
    return round(min(total, 15.0), 1) if total else None


def _guess_location(blob: str) -> str:
    places = (
        ("bangalore", "Bangalore"),
        ("bengaluru", "Bengaluru"),
        ("lucknow", "Lucknow"),
        ("hyderabad", "Hyderabad"),
        ("mumbai", "Mumbai"),
        ("pune", "Pune"),
        ("delhi", "Delhi"),
        ("warsaw", "Warsaw"),
        ("alberta", "Alberta"),
        ("calgary", "Calgary"),
        ("seattle", "Seattle"),
        ("washington", "Washington"),
        ("dubai", "Dubai"),
        ("abu dhabi", "Abu Dhabi"),
        ("sharjah", "Sharjah"),
        ("uae", "UAE"),
        ("riyadh", "Riyadh"),
        ("doha", "Doha"),
        ("india", "India"),
        ("canada", "Canada"),
        ("poland", "Poland"),
        ("united states", "United States"),
        ("usa", "USA"),
    )
    for needle, label in places:
        if needle in blob:
            return label
    return ""


def _title_must_from_skills(skills: list[str], titles: list[str]) -> list[str]:
    must = []
    blob = " ".join(skills + [t.lower() for t in titles])
    for token in (
        "network",
        "noc",
        "cisco",
        "it support",
        "infrastructure",
        "helpdesk",
        "service desk",
        "systems admin",
        "security",
        "cloud",
        "devops",
        "data",
        "analyst",
        "developer",
    ):
        if token in blob:
            must.append(token)
    return must or ["network", "noc", "it support", "engineer"]


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out
