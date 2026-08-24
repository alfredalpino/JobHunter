#!/usr/bin/env python3
"""JobHunter CLI — worldwide job search / filter engine."""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from pipeline import run_hunt  # noqa: E402
from preferences import list_regions  # noqa: E402
from profile_builder import build_profile, list_aspirants, load_aspirant, save_aspirant  # noqa: E402


def cmd_analyze(args: argparse.Namespace) -> int:
    resume = Path(args.resume).expanduser() if args.resume else None
    if resume and not resume.exists():
        raise SystemExit(f"Resume not found: {resume}")
    paste = ""
    if args.linkedin_paste:
        paste = Path(args.linkedin_paste).read_text(encoding="utf-8")
    overrides = {}
    if args.name or args.email:
        overrides["candidate"] = {
            k: v
            for k, v in {"name": args.name or "", "email": args.email or ""}.items()
            if v
        }
    region = (getattr(args, "region", None) or "").strip() or None
    prefs = {}
    if region:
        prefs["region"] = region
    if getattr(args, "locations", None):
        prefs["locations"] = [x.strip() for x in args.locations.split(",") if x.strip()]
    profile = build_profile(
        resume_path=resume,
        linkedin_url=args.linkedin or "",
        linkedin_paste=paste,
        manual_overrides=overrides or None,
        use_ai=bool(getattr(args, "ai", False)),
        ai_model=args.model,
    )
    path = save_aspirant(
        profile,
        aspirant_id=args.id,
        preferences=prefs or None,
        region=region,
    )
    if resume:
        shutil.copy2(resume, path.parent / f"cv{resume.suffix.lower()}")
    profile = load_aspirant(path.parent.name)
    cand = profile["candidate"]
    print(f"Saved → {path}")
    print(f"  Id:      {path.parent.name}")
    print(f"  Name:    {cand.get('name')}")
    print(f"  Search:  {', '.join(profile.get('search_queries') or [])}")
    print(f"  Region:  {(profile.get('geo') or {}).get('region') or (profile.get('geo') or {}).get('default_locations')}")
    print(f"  Level:   {(profile.get('experience') or {}).get('level')} (max job: {(profile.get('experience') or {}).get('max_job_level')})")
    print(f"  Sources: {', '.join(profile.get('sources') or [])}")
    print(f"  Prefs:   {path.parent / 'preferences.yaml'}")
    if profile.get("plain_summary"):
        print(f"\n{profile['plain_summary']}")
    print(f"\nNext: ./run.sh easy-hunt --id {path.parent.name}")
    return 0


def cmd_hunt(args: argparse.Namespace) -> int:
    payload = run_hunt(
        aspirant_id=args.id,
        quick=args.quick,
        use_firecrawl=not args.no_firecrawl,
        query_limit=args.queries,
        portal_ids=[p.strip() for p in (args.portals or "").split(",") if p.strip()] or None,
    )
    print(
        f"\nDone. {payload['eligible_count']} matches "
        f"({payload['last_7_days_count']} last 7 days · "
        f"{payload['days_8_to_14_count']} 8–14 days)."
    )
    print(f"Open: data/exports/{args.id}/eligible.md")
    return 0


def cmd_list(_: argparse.Namespace) -> int:
    ids = list_aspirants()
    if not ids:
        print("No profiles yet. Try: ./run.sh easy --resume your-cv.pdf --name \"Your Name\"")
        return 0
    for aid in ids:
        print(aid)
    return 0


def cmd_regions(_: argparse.Namespace) -> int:
    for name in list_regions():
        print(name)
    print("\nEdit: config/regions/<name>.yaml  or  aspirants/<id>/preferences.yaml")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    def add_analyze(name: str, help_text: str) -> argparse.ArgumentParser:
        p = sub.add_parser(name, help=help_text)
        p.add_argument("--resume", help="CV path (PDF/MD/TXT)")
        p.add_argument("--linkedin", help="Public LinkedIn URL")
        p.add_argument("--linkedin-paste", help="Text file with LinkedIn About+Experience")
        p.add_argument("--name")
        p.add_argument("--email")
        p.add_argument("--id", help="Profile folder name")
        p.add_argument(
            "--region",
            help=f"Region pack: {', '.join(list_regions())}",
        )
        p.add_argument(
            "--locations",
            help='Comma-separated cities/countries, e.g. "Bangalore,India"',
        )
        p.add_argument(
            "--ai",
            action="store_true",
            help="Optional: one tiny Gemini Flash refine via agy (uses tokens). Off by default.",
        )
        p.add_argument("--model", default="gemini-3.5-flash-low", help="agy model when --ai")
        p.set_defaults(func=cmd_analyze)
        return p

    add_analyze("analyze", "Build eligibility from CV / LinkedIn")
    add_analyze("easy", "Same as analyze — simplest name for beginners")

    def add_hunt(name: str, help_text: str, *, default_quick: bool = False) -> None:
        p = sub.add_parser(name, help=help_text)
        p.add_argument("--id", required=True)
        p.add_argument("--quick", action="store_true", default=default_quick)
        p.add_argument("--no-firecrawl", action="store_true")
        p.add_argument("--queries", type=int, default=None)
        p.add_argument("--portals", default="")
        p.set_defaults(func=cmd_hunt)

    add_hunt("hunt", "Scrape portals for an aspirant")
    add_hunt("easy-hunt", "Find jobs (defaults to quick mode)", default_quick=True)

    p_l = sub.add_parser("list", help="List saved profiles")
    p_l.set_defaults(func=cmd_list)

    p_r = sub.add_parser("regions", help="List region packs")
    p_r.set_defaults(func=cmd_regions)

    args = parser.parse_args()
    # easy-hunt: if user did not pass --quick explicitly, keep default_quick True
    if args.cmd == "easy-hunt" and not getattr(args, "quick", False):
        # argparse store_true with default True is awkward; force quick for easy-hunt
        args.quick = True
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
