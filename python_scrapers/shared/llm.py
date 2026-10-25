"""Sumopod AI wrapper (OpenAI-compatible chat completions).

Used by the per-site LLM extractor and by the AI research agent. The API
key comes ONLY from the SUMOPOD_AI_KEY env var (GitHub Actions secret /
.env.local). There is deliberately no hardcoded fallback key.

A process-wide circuit breaker trips on hard auth/quota failures (401,
402, 403, blocked key) so a dead key does not cost one network round
trip per buyer. 429 rate limits are retried with backoff instead.
"""

from __future__ import annotations
import os
import re
import json
import asyncio
from typing import Any, Optional
import httpx


DEFAULT_URL = "https://ai.sumopod.com/v1/chat/completions"
DEFAULT_MODEL = "MiniMax-M3.1-Flash-Preview"

_THINK_RE = re.compile(r"<think>.*?(</think>|$)", re.S | re.I)


def strip_think(text: str) -> str:
    """Remove <think>...</think> reasoning blocks some models emit."""
    return _THINK_RE.sub("", text or "").strip()


def parse_json_loose(text: str):
    """Parse JSON from model output: tolerates <think> blocks, ```json
    fences and prose around the object. Returns None if nothing parses."""
    t = strip_think(text)
    if not t:
        return None
    try:
        return json.loads(t)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*(.*?)```", t, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    start = t.find("{")
    while start != -1:
        depth, in_str, esc = 0, False, False
        for i in range(start, len(t)):
            ch = t[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            elif ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(t[start:i + 1])
                    except Exception:
                        break
        start = t.find("{", start + 1)
    return None


def _url() -> str:
    return os.environ.get("SUMOPOD_AI_URL") or DEFAULT_URL


def _model() -> str:
    return os.environ.get("AGENT_MODEL") or os.environ.get("SUMOPOD_MODEL") or DEFAULT_MODEL


def _key() -> str:
    return os.environ.get("SUMOPOD_AI_KEY", "").strip()


class LLMUnavailable(RuntimeError):
    """Raised when the LLM upstream is unusable for the rest of the run."""


_DEAD: Optional[str] = None


def dead_reason() -> Optional[str]:
    return _DEAD


def _trip(reason: str) -> None:
    global _DEAD
    if not _DEAD:
        _DEAD = reason
        print(f"[llm] Sumopod disabled for this run: {reason}")


async def chat(
    messages: list[dict],
    tools: Optional[list[dict]] = None,
    *,
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 1500,
    json_mode: bool = False,
    timeout: float = 60.0,
    retries: int = 3,
) -> dict:
    """One chat completion. Returns the assistant `message` dict
    (with optional `tool_calls`) plus a `_usage` key. Raises
    LLMUnavailable on auth/quota failure or exhausted retries."""
    if _DEAD:
        raise LLMUnavailable(_DEAD)
    key = _key()
    if not key:
        _trip("SUMOPOD_AI_KEY not set")
        raise LLMUnavailable(_DEAD or "no key")

    body: dict[str, Any] = {
        "model": model or _model(),
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}

    last_err = "unknown"
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(_url(), headers=headers, json=body)
        except Exception as e:  # network
            last_err = f"network: {e}"
            await asyncio.sleep(2 * (attempt + 1))
            continue
        if res.status_code in (401, 402, 403):
            _trip(f"{res.status_code}: {res.text[:200]}")
            raise LLMUnavailable(_DEAD or "auth")
        if res.status_code == 429 or res.status_code >= 500:
            last_err = f"{res.status_code}: {res.text[:200]}"
            await asyncio.sleep(5 * (attempt + 1))
            continue
        if res.status_code == 400 and "response_format" in body:
            # Some models reject json_object mode; the prompt already asks for JSON.
            body.pop("response_format", None)
            last_err = f"400: {res.text[:200]}"
            continue
        if res.status_code != 200:
            raise LLMUnavailable(f"{res.status_code}: {res.text[:200]}")
        data = res.json()
        msg = (data.get("choices") or [{}])[0].get("message") or {}
        msg["_usage"] = data.get("usage") or {}
        return msg
    raise LLMUnavailable(f"retries exhausted ({last_err})")


async def extract_json(system_prompt: str, user_content: str, timeout: float = 30.0) -> Any:
    """Send content to the LLM and return a parsed JSON object.

    Returns None on any error (network, parse, empty, dead key). Callers
    should handle None gracefully so a bad AI day never crashes a crawl.
    """
    try:
        msg = await chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content[:12000]},
            ],
            json_mode=True,
            max_tokens=4000,
            timeout=max(timeout, 60.0),
            retries=2,
        )
    except LLMUnavailable:
        return None
    return parse_json_loose(msg.get("content") or "")
