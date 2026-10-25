"""CLI for the AI research agent.

    # live: write to Supabase (needs DATABASE_URL_POSTGRESS + SUMOPOD_AI_KEY)
    python -m python_scrapers.agent.run --minutes 30 --missions 6 --concurrency 2

    # one specific mission
    python -m python_scrapers.agent.run --hs 1801 --country DE

    # no database: results go to agent_output.jsonl
    python -m python_scrapers.agent.run --dry-run --hs 0901 --country JP

Exits non-zero only when nothing could run at all (no key / no DB).
"""

from __future__ import annotations
import os
import sys
import time
import asyncio
import argparse

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    __package__ = "python_scrapers.agent"  # noqa: A001

from ..shared import llm  # noqa: E402
from ..shared.commodities import by_hs  # noqa: E402
from .agent import ResearchAgent  # noqa: E402
from .planner import plan  # noqa: E402
from .store import DbStore, DryRunStore  # noqa: E402
from .web import Searcher, Fetcher  # noqa: E402


def _load_env_local() -> None:
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    p = os.path.join(root, ".env.local")
    if not os.path.exists(p):
        return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        os.environ.setdefault(k, v)


async def main_async(a: argparse.Namespace) -> int:
    store = DryRunStore(a.out) if a.dry_run else DbStore()
    only_hs = [h.strip() for h in a.hs.split(",")] if a.hs else None
    only_co = [c.strip().upper() for c in a.country.split(",")] if a.country else None

    if only_hs:
        for h in only_hs:
            if not by_hs(h):
                print(f"[agent] unknown HS {h}; add it to config/commodities.json")
                return 2
    try:
        coverage = store.coverage()
    except Exception as e:
        print(f"[agent] could not read coverage ({e}); planning without it")
        coverage = {}
    missions = plan(coverage, a.missions, cooldown_days=a.cooldown_days, max_priority=a.max_priority,
                    only_hs=only_hs, only_countries=only_co)
    if not missions:
        print("[agent] nothing to do (all pairs inside cooldown window)")
        return 0
    print(f"[agent] {len(missions)} missions planned: " +
          ", ".join(f"{c['hs4']}/{co}" for c, co in missions))

    searcher, fetcher = Searcher(), Fetcher(respect_robots=not a.ignore_robots)
    deadline = time.time() + a.minutes * 60
    sem = asyncio.Semaphore(a.concurrency)
    results = []

    async def one(com: dict, co: str) -> None:
        async with sem:
            if time.time() > deadline - 60 or llm.dead_reason():
                return
            agent = ResearchAgent(store, searcher=searcher, fetcher=fetcher, max_steps=a.max_steps,
                                  target=a.target, model=a.model, verbose=not a.quiet)
            try:
                r = await asyncio.wait_for(agent.run_mission(com, co), timeout=max(60, deadline - time.time()))
                results.append(r)
            except asyncio.TimeoutError:
                print(f"[agent] {com['hs4']}/{co} hit the wall-clock budget")

    await asyncio.gather(*(one(c, co) for c, co in missions))

    saved = sum(r.saved for r in results)
    new = sum(r.new for r in results)
    tokens = sum(r.tokens for r in results)
    print(f"[agent] SUMMARY missions={len(results)} saved={saved} new={new} "
          f"rejected={sum(r.rejected for r in results)} searches={searcher.calls} pages={fetcher.calls} tokens={tokens}")
    if llm.dead_reason():
        print(f"::error::Sumopod LLM unavailable: {llm.dead_reason()}")
        # Fail the run (red X) when the key is dead and nothing was saved,
        # so a blocked key is not mistaken for a working agent.
        if saved == 0:
            return 3
    return 0


def cli() -> None:
    _load_env_local()
    p = argparse.ArgumentParser(description="EksporIn AI buyer research agent")
    p.add_argument("--minutes", type=float, default=30)
    p.add_argument("--missions", type=int, default=6, help="how many (HS, country) missions to plan")
    p.add_argument("--concurrency", type=int, default=2)
    p.add_argument("--max-steps", type=int, default=30, help="tool calls per mission")
    p.add_argument("--target", type=int, default=8, help="buyers to find per mission")
    p.add_argument("--hs", help="comma list of HS-4 codes to restrict to")
    p.add_argument("--country", help="comma list of ISO-2 countries to restrict to")
    p.add_argument("--max-priority", type=int, default=3)
    p.add_argument("--cooldown-days", type=float, default=10)
    p.add_argument("--model", default=os.environ.get("AGENT_MODEL") or None)
    p.add_argument("--dry-run", action="store_true", help="no database; write JSONL to --out")
    p.add_argument("--out", default="agent_output.jsonl")
    p.add_argument("--ignore-robots", action="store_true")
    p.add_argument("--quiet", action="store_true")
    a = p.parse_args()
    if not a.dry_run and not (os.environ.get("DATABASE_URL_POSTGRESS") or os.environ.get("DATABASE_URL")):
        print("::error::DATABASE_URL_POSTGRESS not set (use --dry-run to test without a database)")
        sys.exit(1)
    if not os.environ.get("SUMOPOD_AI_KEY"):
        print("::error::SUMOPOD_AI_KEY not set")
        sys.exit(1)
    sys.exit(asyncio.run(main_async(a)))


if __name__ == "__main__":
    cli()
