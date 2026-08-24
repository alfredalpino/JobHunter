from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from profile_cv import analyze_resume_text


SAMPLE = """
UBAID UR RAHMAN
Network Engineer · CCNA · CompTIA Security+
hi@alubaid.xyz · linkedin.com/in/alfredalpino
Open to: Remote Network Engineer · NOC L1/L2 · Network Analyst · GCC

## TECHNICAL SKILLS
VLAN · OSPF · Cisco · NOC · troubleshooting · Azure

## EXPERIENCE
Tikona Infinet Ltd. — IT Support Specialist (ISP Networking)
Dec 2022 – Mar 2023 · Pune, India
"""


def test_analyze_resume_extracts_core_fields() -> None:
    profile = analyze_resume_text(SAMPLE)
    assert "ubaid" in profile["candidate"]["name"].lower()
    assert profile["candidate"]["email"] == "hi@alubaid.xyz"
    assert "CCNA" in profile["certifications"]
    assert any("network" in t.lower() or "noc" in t.lower() for t in profile["target_titles"])
    assert "cisco" in profile["skills_positive"] or "noc" in profile["skills_positive"]
