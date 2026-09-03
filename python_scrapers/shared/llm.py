"""Sumopod AI wrapper for LLM-based extraction. Same OpenAI-compatible
endpoint the Node.js worker uses; the API key is shared via env."""

from __future__ import annotations
import os
import json
import httpx
from typing import Any


SUMOPOD_AI_URL = "https://ai.sumopod.com/v1/chat/completions"
MODEL = "gpt-4o-mini"


def _key() -> str:
    return os.environ.get("SUMOPOD_AI_KEY", "sk-jzbEVp009nE3qAPxXvbJSg")


async def extract_json(system_prompt: str, user_content: str, timeout: float = 30.0) -> Any:
    """Send content to the LLM and return a parsed JSON object.

    Returns None on any error (network, parse, empty). Callers should
    handle None gracefully so a bad AI day never crashes a crawl.
    """
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content[:12000]},
        ],
        "temperature": 0.1,
        "max_tokens": 2000,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_key()}",
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(SUMOPOD_AI_URL, headers=headers, json=body)
            res.raise_for_status()
            data = res.json()
            raw = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not raw:
                return None
            return json.loads(raw)
    except Exception:
        return None
