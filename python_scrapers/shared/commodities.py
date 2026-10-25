"""Loads config/commodities.json, the shared commodity x country matrix
used by every crawler, the AI research agent and the Node pipeline."""

from __future__ import annotations
import json
import os
from functools import lru_cache
from typing import Any

_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "config", "commodities.json",
)


@lru_cache(maxsize=1)
def load() -> dict[str, Any]:
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def commodities(max_priority: int = 3) -> list[dict[str, Any]]:
    return [c for c in load()["commodities"] if int(c.get("priority", 2)) <= max_priority]


def countries(max_priority: int = 3) -> list[dict[str, Any]]:
    return [c for c in load()["countries"] if int(c.get("priority", 2)) <= max_priority]


def by_hs(hs4: str) -> dict[str, Any] | None:
    for c in load()["commodities"]:
        if c["hs4"] == hs4:
            return c
    return None


def country_name(iso2: str) -> str:
    for c in load()["countries"]:
        if c["iso2"] == (iso2 or "").upper():
            return c["name"]
    return iso2


def hs_keywords(max_priority: int = 3) -> list[tuple[str, str]]:
    """(hs4, keyword) pairs, the shape the rule-based crawlers iterate."""
    out: list[tuple[str, str]] = []
    for c in commodities(max_priority):
        for kw in c.get("keywords") or []:
            out.append((c["hs4"], kw))
    return out


def country_codes(max_priority: int = 3) -> list[str]:
    return [c["iso2"] for c in countries(max_priority)]
