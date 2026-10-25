"""Chooses which (commodity, country) missions the agent works on next.

Score favours: high-priority commodities and markets, pairs with few
buyers in the database, pairs never researched or not researched for a
while, and pairs whose last run actually yielded buyers. Pairs researched
within the cooldown window are skipped, so repeated GitHub Actions runs
sweep the whole matrix instead of re-doing the same pair.
"""

from __future__ import annotations
import random
import time
from typing import Any

from ..shared.commodities import commodities, countries

PRIORITY_WEIGHT = {1: 3.0, 2: 1.8, 3: 1.0}


def plan(
    coverage: dict[tuple[str, str], dict[str, Any]],
    n: int,
    *,
    cooldown_days: float = 10.0,
    max_priority: int = 3,
    only_hs: list[str] | None = None,
    only_countries: list[str] | None = None,
    seed: int | None = None,
) -> list[tuple[dict, str]]:
    rng = random.Random(seed)
    now = time.time()
    scored: list[tuple[float, dict, str]] = []
    for com in commodities(max_priority):
        if only_hs and com["hs4"] not in only_hs:
            continue
        for co in countries(max_priority):
            if only_countries and co["iso2"] not in only_countries:
                continue
            cov = coverage.get((com["hs4"], co["iso2"]), {})
            last = cov.get("last_agent_run")
            age_days = (now - last) / 86400 if last else None
            if age_days is not None and age_days < cooldown_days and not (only_hs or only_countries):
                continue
            buyers = int(cov.get("buyers") or 0)
            s = PRIORITY_WEIGHT.get(int(com.get("priority", 2)), 1.0) * PRIORITY_WEIGHT.get(int(co.get("priority", 2)), 1.0)
            s *= 1.0 / (1.0 + buyers / 15.0)           # fewer buyers -> more urgent
            if age_days is None:
                s *= 1.5                                 # never researched
            elif cov.get("last_agent_yield") == 0:
                s *= 0.4                                 # last attempt found nothing
            s *= 0.75 + rng.random() * 0.5               # jitter so runs differ
            scored.append((s, com, co["iso2"]))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [(com, iso) for _, com, iso in scored[:n]]
