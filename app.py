"""JobHunter — worldwide job search (non-technical friendly)."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import streamlit as st
import yaml

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from ai_gemini import agy_available  # noqa: E402
from pipeline import run_hunt  # noqa: E402
from preferences import list_regions  # noqa: E402
from profile_builder import build_profile, list_aspirants, load_aspirant, save_aspirant  # noqa: E402

st.set_page_config(page_title="JobHunter", page_icon="🎯", layout="centered")

st.markdown(
    """
    <style>
      .big-title { font-size: 2.2rem; font-weight: 700; margin-bottom: 0.2rem; }
      .hint { color: #444; font-size: 1.05rem; margin-bottom: 1.2rem; }
      div.stButton > button { font-size: 1.15rem; padding: 0.7rem 1rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown('<div class="big-title">JobHunter</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="hint">Find jobs that match your resume — anywhere in the world. '
    'Only fresh postings from the last 1–2 weeks.</div>',
    unsafe_allow_html=True,
)

agy_ok = agy_available()
if agy_ok:
    st.caption(
        "Antigravity found. AI is **off** by default (fast, free). "
        "Turn on only if you want Gemini to polish the profile once."
    )
else:
    st.caption("Runs fully offline for CV scan + job search. Antigravity is optional.")

step = st.radio(
    "What do you want to do?",
    ["1 · Upload my CV", "2 · Find matching jobs", "3 · See my results"],
    horizontal=True,
)

regions = list_regions() or ["dubai", "usa", "india", "remote", "worldwide"]

if step.startswith("1"):
    st.subheader("Upload your CV")
    uploaded = st.file_uploader("Your resume (PDF is best)", type=["pdf", "md", "txt"])
    name = st.text_input("Your name")
    region = st.selectbox(
        "Where do you want jobs?",
        regions,
        index=regions.index("dubai") if "dubai" in regions else 0,
        help="Pick a region pack (city/country). Fine-tune later in preferences.yaml.",
    )
    locations = st.text_input(
        "Cities / countries (optional)",
        placeholder="e.g. Bangalore, India — or leave blank to use the region pack",
    )
    linkedin = st.text_input("LinkedIn link (optional)", placeholder="https://www.linkedin.com/in/...")
    use_ai = st.checkbox(
        "Optional: polish profile with Gemini once (uses a little Antigravity credit)",
        value=False,
        help="Default is OFF. Local CV scan is enough for most people and is much faster.",
    )
    if st.button("Analyze my profile", type="primary", use_container_width=True):
        if not uploaded:
            st.error("Please upload your CV first.")
        else:
            uploads = ROOT / "uploads"
            uploads.mkdir(exist_ok=True)
            path = uploads / uploaded.name
            path.write_bytes(uploaded.getvalue())
            prefs = {"region": region, "use_jobspy": True}
            if locations.strip():
                prefs["locations"] = [x.strip() for x in locations.split(",") if x.strip()]
            with st.spinner("Reading your CV… this can take a minute if Gemini is on."):
                try:
                    profile = build_profile(
                        resume_path=path,
                        linkedin_url=linkedin,
                        manual_overrides={"candidate": {"name": name}} if name else None,
                        use_ai=use_ai,
                    )
                    saved = save_aspirant(profile, preferences=prefs, region=region)
                    shutil.copy2(path, saved.parent / f"cv{path.suffix.lower()}")
                    profile = load_aspirant(saved.parent.name)
                    st.session_state["aspirant_id"] = saved.parent.name
                    st.success(f"Saved! Your id is: **{saved.parent.name}**")
                    if profile.get("plain_summary"):
                        st.write(profile["plain_summary"])
                    st.write("**Jobs we’ll search for:**", ", ".join(profile.get("search_queries") or []))
                    st.write("**Region:**", (profile.get("geo") or {}).get("region") or region)
                    exp = profile.get("experience") or {}
                    st.write(
                        "**Seniority:**",
                        f"{exp.get('level')} (max job level: {exp.get('max_job_level')})",
                    )
                    st.write("**Skills detected:**", ", ".join((profile.get("skills_positive") or [])[:12]))
                    st.info(
                        f"Easy settings: aspirants/{saved.parent.name}/preferences.yaml "
                        "(see config/preferences.example.yaml)."
                    )
                    st.write("**Next:** choose **2 · Find matching jobs** above.")
                except Exception as exc:  # noqa: BLE001
                    st.error(str(exc))

elif step.startswith("2"):
    st.subheader("Find matching jobs")
    ids = list_aspirants()
    if not ids:
        st.warning("No profile yet. Go to step 1 and upload your CV.")
    else:
        default = st.session_state.get("aspirant_id") or ids[0]
        selected = st.selectbox(
            "Whose profile?", ids, index=ids.index(default) if default in ids else 0
        )
        mode = st.radio(
            "How thorough?",
            ["Quick (a few minutes)", "Full scan (longer, more portals)"],
            horizontal=True,
        )
        st.caption("We only keep jobs posted in the last 7 days or 8–14 days. Older ads are ignored.")
        st.caption("Tip: pip install python-jobspy for Indeed/LinkedIn/Google worldwide boards.")
        if st.button("Find matching jobs", type="primary", use_container_width=True):
            with st.spinner("Searching job portals… please wait."):
                try:
                    payload = run_hunt(
                        aspirant_id=selected,
                        quick=mode.startswith("Quick"),
                        query_limit=1,
                    )
                    st.session_state["last_id"] = selected
                    st.success(
                        f"Found **{payload['eligible_count']}** matching fresh jobs "
                        f"({payload['last_7_days_count']} in last 7 days, "
                        f"{payload['days_8_to_14_count']} in 8–14 days)."
                    )
                    st.write("Open step **3 · See my results**.")
                except Exception as exc:  # noqa: BLE001
                    st.error(str(exc))

else:
    st.subheader("Your results")
    ids = list_aspirants()
    selected = st.selectbox(
        "Profile",
        ids or [""],
        index=(
            ids.index(st.session_state["last_id"])
            if st.session_state.get("last_id") in ids
            else 0
        )
        if ids
        else 0,
    )
    md = ROOT / "data" / "exports" / selected / "eligible.md" if selected else None
    if md and md.exists():
        st.markdown(md.read_text(encoding="utf-8"))
        st.download_button(
            "Download results",
            md.read_text(encoding="utf-8"),
            file_name="jobhunter-results.md",
        )
    else:
        st.write("No results yet. Run step 2 first.")

    if selected and (ROOT / "aspirants" / selected / "profile.yaml").exists():
        with st.expander("My saved profile (advanced)"):
            st.code(
                yaml.safe_dump(load_aspirant(selected), sort_keys=False, allow_unicode=True),
                language="yaml",
            )
        prefs = ROOT / "aspirants" / selected / "preferences.yaml"
        if prefs.exists():
            with st.expander("My preferences (easy edit file)"):
                st.code(prefs.read_text(encoding="utf-8"), language="yaml")
