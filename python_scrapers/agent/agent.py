"""The research agent loop.

One *mission* = (commodity HS-4, destination country). The LLM gets a
small toolbox and works like a human trade researcher:

    web_search -> open_page (company site, contact/about page)
               -> save_buyer (verified server-side) -> ... -> finish

The model never writes to the database directly: save_buyer runs the
deterministic checks in verify.py and only grounded records are stored.
Works with OpenAI-style native tool calling; if the upstream model
rejects `tools`, it falls back to a JSON action protocol.
"""

from __future__ import annotations
import json
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from ..shared import llm
from ..shared.commodities import country_name
from .verify import Session, verify_candidate, BUYER_TYPES
from .web import Searcher, Fetcher, search_queries_for, host_of, is_non_company_host
from .store import Store


TOOLS: list[dict] = [
    {"type": "function", "function": {
        "name": "web_search",
        "description": "Search the web. Returns up to 8 results (title, url, snippet). Use specific queries, "
                       "including the local language of the target country.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "open_page",
        "description": "Open a URL and read it. Returns page title, text excerpt, emails and phones found, "
                       "and links to contact/about pages on the same site. You MUST open a page before citing it.",
        "parameters": {"type": "object", "properties": {
            "url": {"type": "string"},
            "focus": {"type": "string", "description": "optional word to centre the excerpt on, e.g. 'import' or 'contact'"}},
            "required": ["url"]}}},
    {"type": "function", "function": {
        "name": "check_known",
        "description": "Check whether a company is already in the EksporIn database for this country.",
        "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}}},
    {"type": "function", "function": {
        "name": "save_buyer",
        "description": "Save one verified foreign BUYER of the commodity. The server re-checks everything against "
                       "pages you opened; rejected saves return the reason so you can fix and retry.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string", "description": "legal or trading name exactly as on the page"},
            "country": {"type": "string", "description": "ISO-2 country where the company is based"},
            "buyer_type": {"type": "string", "enum": sorted(BUYER_TYPES)},
            "website": {"type": "string", "description": "company's OWN website root, not a directory"},
            "evidence_url": {"type": "string", "description": "a page you opened that shows they buy/sell this product"},
            "evidence_quote": {"type": "string", "description": "exact sentence copied from evidence_url"},
            "products": {"type": "string", "description": "what they import/use, short"},
            "city": {"type": "string"}, "address": {"type": "string"},
            "email": {"type": "string", "description": "only if shown on a page you opened"},
            "phone": {"type": "string", "description": "only if shown on a page you opened"},
            "description": {"type": "string", "description": "one factual English sentence, max 25 words"},
            "size_bucket": {"type": "string", "enum": ["small", "medium", "large"]},
            "industry": {"type": "string", "description": "short lowercase label e.g. 'cocoa importer'"}},
            "required": ["name", "country", "buyer_type", "evidence_url", "evidence_quote"]}}},
    {"type": "function", "function": {
        "name": "finish",
        "description": "End the mission when the target is reached or no more good leads exist.",
        "parameters": {"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]}}},
]

SYSTEM_PROMPT = """You are a B2B trade researcher working for EksporIn, a platform that helps small Indonesian exporters find foreign buyers.

Your job in each mission: find REAL companies based in the target country that BUY the target commodity in commercial volume: importers, distributors, wholesalers, traders, roasters/processors/manufacturers that use it as a raw material, or retail chains/brands that source it directly. Save each one with save_buyer.

How to work:
1. web_search with varied queries: buyer terms + country, the product name in the country's own language (e.g. German "Kakao Importeur", French "importateur de cacao", Japanese "カカオ豆 輸入"), trade-association member lists, trade-fair exhibitor lists, "where we source" pages.
2. open_page the company's OWN website (home, then the about/contact page listed in contact_links) to confirm what they do and get contact details. Directory/list pages are fine for discovery but always try to reach the company's own site.
3. save_buyer with an exact quote from a page you opened that shows they deal in the product or import it.

Hard rules:
- Never invent facts, emails or phones. Only report what you read on pages you opened.
- Do NOT save Indonesian companies, origin exporters/suppliers selling TO buyers, marketplaces (Alibaba etc.), directories, logistics firms, consultancies, news sites or tiny single cafes/shops.
- Skip companies already listed under "already known" and use check_known when unsure.
- If save_buyer rejects, read the reason; fix it (open the right page / copy an exact quote) or move on.
- Be efficient: you have a limited step budget. Call finish when the target is met or leads are exhausted."""


JSON_PROTOCOL = """
You cannot call tools natively. Instead reply ONLY with one JSON object per turn:
{"tool": "<web_search|open_page|check_known|save_buyer|finish>", "args": {...}}
Tool results will be sent back to you as the next user message."""


@dataclass
class MissionResult:
    hs4: str
    country: str
    saved: int = 0
    new: int = 0
    rejected: int = 0
    steps: int = 0
    searches: int = 0
    pages: int = 0
    tokens: int = 0
    error: Optional[str] = None
    summary: str = ""
    buyers: list[str] = field(default_factory=list)
    seconds: float = 0.0
    prose_replies: int = 0

    def meta(self) -> dict:
        return {k: getattr(self, k) for k in
                ("saved", "new", "rejected", "steps", "searches", "pages", "tokens", "summary", "buyers", "seconds")}


def _excerpt(text: str, focus: Optional[str], n: int) -> str:
    if len(text) <= n:
        return text
    if focus:
        i = text.lower().find(focus.lower())
        if i > 0:
            start = max(0, i - n // 3)
            return ("..." if start else "") + text[start:start + n] + "..."
    return text[:n] + "..."


class ResearchAgent:
    def __init__(
        self,
        store: Store,
        *,
        searcher: Optional[Searcher] = None,
        fetcher: Optional[Fetcher] = None,
        max_steps: int = 30,
        target: int = 8,
        page_chars: int = 4500,
        model: Optional[str] = None,
        verbose: bool = True,
        max_tokens: int = 4000,
    ) -> None:
        self.store = store
        self.searcher = searcher or Searcher()
        self.fetcher = fetcher or Fetcher()
        self.max_steps = max_steps
        self.target = target
        self.page_chars = page_chars
        self.model = model
        self.verbose = verbose
        self.max_tokens = max_tokens  # reasoning models spend tokens thinking
        self.native_tools = True

    def log(self, msg: str) -> None:
        if self.verbose:
            print(msg, flush=True)

    # ------------------------------------------------------------ tools

    async def _tool(self, name: str, args: dict, ctx: dict) -> dict:
        session: Session = ctx["session"]
        res: MissionResult = ctx["result"]
        commodity = ctx["commodity"]
        country = ctx["country"]

        if name == "web_search":
            q = str(args.get("query") or "").strip()
            if not q:
                return {"error": "query required"}
            res.searches += 1
            hits = await self.searcher.search(q)
            self.log(f"  [{ctx['tag']}] search: {q!r} -> {len(hits)} hits")
            return {"results": [
                {"title": h.title[:120], "url": h.url, "snippet": h.snippet[:240],
                 "note": "directory/social" if is_non_company_host(h.url) else None}
                for h in hits]}

        if name == "open_page":
            url = str(args.get("url") or "").strip()
            if not url:
                return {"error": "url required"}
            if host_of(url).endswith(".id"):
                return {"error": "Indonesian domain skipped: we are looking for foreign buyers"}
            cached = session.get(url)
            page = cached or await self.fetcher.fetch(url)
            if not cached:
                res.pages += 1
                session.add(page)
            self.log(f"  [{ctx['tag']}] open: {url} -> {page.error or f'{len(page.text)} chars'}")
            if page.error and not page.text:
                return {"url": page.final_url, "error": page.error}
            return {
                "url": page.final_url, "title": page.title[:150],
                "text": _excerpt(page.text, args.get("focus"), self.page_chars),
                "emails": page.emails, "phones": page.phones,
                "contact_links": page.contact_links,
                "warning": page.error,
            }

        if name == "check_known":
            nm = str(args.get("name") or "")
            known = nm.lower() in ctx["known_lower"] or self.store.is_known(nm, country)
            return {"known": bool(known)}

        if name == "save_buyer":
            v = verify_candidate(args, session=session, mission_country=country, commodity=commodity)
            if not v.ok:
                res.rejected += 1
                self.log(f"  [{ctx['tag']}] REJECT {args.get('name')!r}: {v.reason}")
                return {"saved": False, "reason": v.reason}
            rec = v.record
            assert rec is not None
            if rec["name"].lower() in ctx["saved_lower"]:
                return {"saved": False, "reason": "already saved in this mission"}
            row_id, is_new = self.store.save(rec)
            ctx["saved_lower"].add(rec["name"].lower())
            res.saved += 1
            res.new += int(is_new)
            res.buyers.append(rec["name"])
            self.log(f"  [{ctx['tag']}] SAVED {rec['name']!r} conf={rec['data_confidence']} "
                     f"email={'y' if rec['email'] else 'n'} new={is_new}")
            return {"saved": True, "id": row_id, "confidence": rec["data_confidence"],
                    "warnings": v.warnings, "progress": f"{res.saved}/{self.target}"}

        if name == "finish":
            ctx["done"] = True
            res.summary = str(args.get("summary") or "")[:500]
            return {"ok": True}

        return {"error": f"unknown tool {name}"}

    # ------------------------------------------------------------ loop

    @staticmethod
    def _compact(messages: list[dict], keep_last: int = 8) -> None:
        """Shrink old tool outputs so long missions stay within context."""
        tool_idx = [i for i, m in enumerate(messages) if m.get("role") == "tool"
                    or (m.get("role") == "user" and m.get("_tool_result"))]
        for i in tool_idx[:-keep_last]:
            c = messages[i].get("content") or ""
            if len(c) > 400:
                messages[i]["content"] = c[:300] + " ...[older result truncated]"

    async def run_mission(self, commodity: dict, country: str) -> MissionResult:
        t0 = time.time()
        hs4 = commodity["hs4"]
        res = MissionResult(hs4=hs4, country=country)
        cname = country_name(country)
        try:
            known = self.store.known_names(hs4, country)
        except Exception as e:
            known = []
            self.log(f"[agent] known_names failed: {e}")
        ctx: dict[str, Any] = {
            "session": Session(), "result": res, "commodity": commodity, "country": country,
            "tag": f"{hs4}/{country}", "done": False,
            "known_lower": {k.lower() for k in known}, "saved_lower": set(),
        }
        job_id = None
        try:
            job_id = self.store.start_job(hs4, country, {"model": self.model or llm._model(), "target": self.target})
        except Exception as e:
            self.log(f"[agent] start_job failed: {e}")

        brief = (
            f"MISSION: find up to {self.target} buyers in {cname} ({country}) for "
            f"{commodity['label_en']} (HS {hs4}, Indonesian name: {commodity['label_id']}).\n"
            f"Product keywords: {', '.join(commodity.get('keywords') or [])}\n"
            f"Typical buyer types: {', '.join(commodity.get('buyer_terms') or [])}\n"
            f"Suggested first queries: {json.dumps(search_queries_for(commodity, cname))}\n"
            f"Already known (skip these): {json.dumps(known[:60], ensure_ascii=False)}\n"
            f"Step budget: {self.max_steps} tool calls."
        )
        system = SYSTEM_PROMPT + ("" if self.native_tools else JSON_PROTOCOL)
        messages: list[dict] = [{"role": "system", "content": system}, {"role": "user", "content": brief}]
        self.log(f"[agent] mission {hs4} {commodity['label_en']} -> {cname}")

        try:
            while res.steps < self.max_steps and not ctx["done"] and res.saved < self.target:
                self._compact(messages)
                calls = await self._next_actions(messages, res)
                if calls is None:
                    break
                for call_id, name, args in calls:
                    res.steps += 1
                    try:
                        out = await self._tool(name, args, ctx)
                    except Exception as e:
                        out = {"error": f"{type(e).__name__}: {str(e)[:200]}"}
                    payload = json.dumps(out, ensure_ascii=False)[:9000]
                    if self.native_tools:
                        messages.append({"role": "tool", "tool_call_id": call_id, "content": payload})
                    else:
                        messages.append({"role": "user", "content": f"RESULT of {name}: {payload}", "_tool_result": True})
                    if ctx["done"] or res.saved >= self.target:
                        break
                if res.steps >= self.max_steps - 3 and not ctx["done"]:
                    messages.append({"role": "user", "content":
                                     "Step budget almost used. Save any verified buyer now, then call finish."})
        except llm.LLMUnavailable as e:
            res.error = f"llm_unavailable: {e}"
        except Exception as e:
            res.error = f"{type(e).__name__}: {str(e)[:300]}"

        res.seconds = round(time.time() - t0, 1)
        try:
            self.store.finish_job(job_id, saved=res.saved, error=res.error, meta=res.meta())
        except Exception as e:
            self.log(f"[agent] finish_job failed: {e}")
        self.log(f"[agent] done {hs4}/{country}: saved={res.saved} new={res.new} rejected={res.rejected} "
                 f"steps={res.steps} pages={res.pages} tokens={res.tokens} {res.error or ''}")
        return res

    def _switch_to_json_protocol(self, messages: list[dict]) -> None:
        """Rewrite the history (tool messages included) for models that
        do not do native tool calling, then continue in JSON mode."""
        self.native_tools = False
        out: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT + JSON_PROTOCOL}]
        names: dict[str, str] = {}
        for m in messages[1:]:
            role = m.get("role")
            if role == "assistant" and m.get("tool_calls"):
                for tc in m["tool_calls"]:
                    fn = tc.get("function") or {}
                    names[tc.get("id") or ""] = fn.get("name") or ""
                    out.append({"role": "assistant", "content": json.dumps(
                        {"tool": fn.get("name"), "args": llm.parse_json_loose(fn.get("arguments") or "{}") or {}})})
            elif role == "tool":
                out.append({"role": "user", "content": f"RESULT of {names.get(m.get('tool_call_id') or '', 'tool')}: "
                            f"{m.get('content')}", "_tool_result": True})
            else:
                out.append(m)
        messages[:] = out

    @staticmethod
    def _action_from_text(content: str) -> Optional[tuple[str, str, dict]]:
        obj = llm.parse_json_loose(content)
        if isinstance(obj, dict) and obj.get("tool"):
            args = obj.get("args") if isinstance(obj.get("args"), dict) else {}
            return ("", str(obj["tool"]), args)
        return None

    async def _next_actions(self, messages: list[dict], res: MissionResult) -> Optional[list[tuple[str, str, dict]]]:
        clean = [{k: v for k, v in m.items() if not k.startswith("_")} for m in messages]
        if self.native_tools:
            try:
                msg = await llm.chat(clean, tools=TOOLS, model=self.model, max_tokens=self.max_tokens)
            except llm.LLMUnavailable as e:
                text = str(e).lower()
                if "tool" in text or "function" in text:
                    self.log("[agent] model rejected native tools; switching to JSON protocol")
                    self._switch_to_json_protocol(messages)
                    return await self._next_actions(messages, res)
                raise
            res.tokens += int((msg.get("_usage") or {}).get("total_tokens") or 0)
            tool_calls = msg.get("tool_calls") or []
            content = llm.strip_think(msg.get("content") or "")
            if not tool_calls:
                # Some models answer with a JSON action in plain content.
                act = self._action_from_text(content)
                if act:
                    self.log("[agent] model answers with JSON text instead of tool calls; switching protocol")
                    self._switch_to_json_protocol(messages)
                    messages.append({"role": "assistant", "content": content})
                    return [act]
                res.prose_replies += 1
                messages.append({"role": "assistant", "content": content})
                if res.prose_replies >= 2:
                    if res.steps == 0:
                        # Never used a tool: the model probably ignores `tools`.
                        self.log("[agent] model ignores native tools; switching to JSON protocol")
                        self._switch_to_json_protocol(messages)
                        res.prose_replies = 0
                        return []
                    return None
                messages.append({"role": "user", "content": "Use the tools. Continue the mission or call finish."})
                return []
            res.prose_replies = 0
            messages.append({"role": "assistant", "content": content, "tool_calls": tool_calls})
            out = []
            for tc in tool_calls:
                fn = tc.get("function") or {}
                args = llm.parse_json_loose(fn.get("arguments") or "{}")
                out.append((tc.get("id") or "", fn.get("name") or "", args if isinstance(args, dict) else {}))
            return out

        msg = await llm.chat(clean, model=self.model, max_tokens=self.max_tokens, json_mode=True)
        res.tokens += int((msg.get("_usage") or {}).get("total_tokens") or 0)
        content = llm.strip_think(msg.get("content") or "")
        messages.append({"role": "assistant", "content": content})
        act = self._action_from_text(content)
        if act:
            res.prose_replies = 0
            return [act]
        res.prose_replies += 1
        if res.prose_replies >= 3:
            return None
        messages.append({"role": "user", "content": 'Reply with JSON only: {"tool": ..., "args": {...}}',
                         "_tool_result": True})
        return []
