"""  python -m python_scrapers.sources.run discover --minutes 25
  python -m python_scrapers.sources.run harvest --minutes 35 --shard 0 --shards 3
  python -m python_scrapers.sources.run report
"""

from __future__ import annotations
import argparse
import asyncio
import json
import os
import sys

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    __package__ = "python_scrapers.sources"  # noqa: A001

from . import engine  # noqa: E402
from ..shared import llm  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["discover", "harvest", "report"])
    ap.add_argument("--minutes", type=float, default=30)
    ap.add_argument("--max-queries", type=int, default=60)
    ap.add_argument("--shard", type=int, default=0)
    ap.add_argument("--shards", type=int, default=1)
    ap.add_argument("--max-sources", type=int, default=40)
    a = ap.parse_args()
    try:
        if a.cmd == "discover":
            s = asyncio.run(engine.discover(minutes=a.minutes, max_queries=a.max_queries))
        elif a.cmd == "harvest":
            s = asyncio.run(engine.harvest(minutes=a.minutes, shard=a.shard, shards=a.shards, max_sources=a.max_sources))
        else:
            s = engine.report()
    except llm.LLMUnavailable as e:
        print(f"::error::LLM unavailable: {e}")
        return 3
    print(f"::notice title=sources {a.cmd}::{json.dumps(s, default=str)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
