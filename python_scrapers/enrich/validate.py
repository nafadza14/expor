"""Email/phone validation without paid services.

- Syntax + domain match against the company website.
- DNS MX lookup (falls back to A record) with a per-process cache.
- Role vs personal classification (RFC 2142 role mailboxes plus common
  purchasing/import aliases in several languages). Personal-looking
  addresses (firstname.lastname@) are kept but flagged, and role
  addresses are preferred, to stay on the safe side of GDPR/UWG.
- No SMTP RCPT probing (unreliable with catch-all servers, gets runner
  IPs blacklisted).
"""

from __future__ import annotations
import asyncio
import re
from functools import lru_cache
from typing import Optional

EMAIL_OK = re.compile(r"^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$", re.I)

FREEMAIL = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "hotmail.com",
    "hotmail.co.uk", "hotmail.fr", "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
    "gmx.de", "gmx.net", "gmx.at", "web.de", "t-online.de", "freenet.de", "orange.fr", "wanadoo.fr", "free.fr",
    "laposte.net", "libero.it", "virgilio.it", "naver.com", "daum.net", "qq.com", "163.com", "126.com",
    "yandex.ru", "mail.ru", "protonmail.com", "proton.me", "zoho.com", "bigpond.com", "seznam.cz", "wp.pl",
}
DISPOSABLE_HINT = re.compile(r"(mailinator|tempmail|10minutemail|guerrillamail|trashmail)", re.I)

# Best first: people who BUY (what an exporter wants to reach), then general.
ROLE_RANK = [
    ("purchasing", 0), ("purchase", 0), ("procurement", 0), ("buying", 0), ("buyer", 0), ("sourcing", 0),
    ("einkauf", 0), ("achat", 0), ("achats", 0), ("compras", 0), ("acquisti", 0), ("inkoop", 0), ("import", 0),
    ("trade", 1), ("trading", 1), ("commercial", 1), ("export", 1),
    ("info", 2), ("contact", 2), ("kontakt", 2), ("office", 2), ("mail", 2), ("hello", 2), ("hallo", 2),
    ("general", 2), ("enquiries", 2), ("inquiries", 2), ("enquiry", 2), ("inquiry", 2), ("service", 3),
    ("sales", 3), ("vertrieb", 3), ("verkauf", 3), ("ventas", 3), ("vendite", 3), ("order", 3), ("orders", 3),
    ("bestellung", 3), ("admin", 4), ("customerservice", 3), ("support", 4),
]
NOREPLY = re.compile(r"^(no-?reply|do-?not-?reply|bounce|mailer-daemon|postmaster|abuse|webmaster|privacy|datenschutz|gdpr|dpo|jobs|careers|karriere|bewerbung|hr|press|presse|newsletter)\b", re.I)


def email_domain(e: str) -> str:
    return e.rsplit("@", 1)[-1].lower().removeprefix("www.")


def registrable(host: str) -> str:
    """Rough eTLD+1 (handles co.uk / com.au / co.jp style suffixes)."""
    parts = host.lower().removeprefix("www.").split(".")
    if len(parts) >= 3 and parts[-2] in ("co", "com", "org", "net", "ac", "gov", "or", "ne") and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def classify(e: str) -> tuple[str, int]:
    """Returns (kind, rank) where kind in role|personal|other; lower rank = better."""
    local = e.split("@", 1)[0].lower()
    base = re.split(r"[.\-_+0-9]", local)[0]
    for word, rank in ROLE_RANK:
        if local == word or base == word or local.startswith(word):
            return "role", rank
    if re.fullmatch(r"[a-z]{2,}[._-][a-z]{2,}", local) or re.fullmatch(r"[a-z]\.?[a-z]{3,}", local):
        return "personal", 6
    return "other", 5


@lru_cache(maxsize=4096)
def _mx_sync(domain: str) -> bool:
    try:
        import dns.resolver
        r = dns.resolver.Resolver()
        r.lifetime = 6.0
        try:
            return bool(list(r.resolve(domain, "MX")))
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
            pass
        try:
            return bool(list(r.resolve(domain, "A")))
        except Exception:
            return False
    except Exception:
        # Resolver unavailable (e.g. sandbox): do not reject on our own failure.
        return True


async def has_mail_dns(domain: str) -> bool:
    return await asyncio.to_thread(_mx_sync, domain.lower())


@lru_cache(maxsize=8192)
def _a_sync(host: str) -> bool:
    import socket
    try:
        socket.getaddrinfo(host, 443)
        return True
    except Exception:
        return False


async def resolves(host: str) -> bool:
    return await asyncio.to_thread(_a_sync, host.lower())


async def pick_email(candidates: dict[str, str], site_host: Optional[str]) -> Optional[dict]:
    """candidates: {email: source_url}. Returns best {email, status, source_url} or None."""
    site_reg = registrable(site_host) if site_host else None
    scored = []
    for e, src in candidates.items():
        e = e.strip().lower()
        if not EMAIL_OK.match(e) or NOREPLY.match(e.split("@")[0]) or DISPOSABLE_HINT.search(e):
            continue
        dom = email_domain(e)
        same = bool(site_reg and registrable(dom) == site_reg)
        free = dom in FREEMAIL
        if site_reg and not same and not free:
            continue  # someone else's address (agency, platform, partner)
        kind, rank = classify(e)
        scored.append((0 if same else 1, rank, e, src, kind, free))
    scored.sort()
    for _, rank, e, src, kind, free in scored:
        if not free and not await has_mail_dns(email_domain(e)):
            continue
        status = "freemail" if free else ("role" if kind == "role" else ("personal" if kind == "personal" else "domain"))
        return {"email": e, "status": status, "source_url": src}
    return None


def normalize_phone(p: str, country: Optional[str]) -> Optional[str]:
    digits = re.sub(r"[^\d+]", "", p)
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    d = re.sub(r"\D", "", digits)
    if not 8 <= len(d) <= 15:
        return None
    return re.sub(r"\s+", " ", p.strip())[:40]
