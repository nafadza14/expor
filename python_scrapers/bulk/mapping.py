"""Which official activity codes mean "buys this commodity", and which HS
headings a company gets tagged with.

Activity codes are NACE Rev.2 classes (4 digits, "46.37"). National codes
are NACE with extra digits: UK SIC 2007 "46370", Norway SN2007 "46.370",
France NAF "46.37Z". All are reduced to the NACE class before lookup.

Some classes are narrow (46.37 = coffee, tea, cocoa and spices wholesale)
and every company in them is a buyer. Others are broad (46.38 = "other
food"), so a company is only kept when its name, activity text or
products also mention the commodity ("gate").
"""

from __future__ import annotations
import re
from typing import Iterable, Optional

COFFEE = ["0901", "2101"]
TEA = ["0902"]
SPICES = ["0904", "0905", "0906", "0907", "0908", "0910"]
COCOA = ["1801", "1804", "1805"]
SEAFOOD = ["0306", "0304", "1604"]
OILS = ["1513", "1511"]

# Words (several languages) that pin a company in a mixed class to the
# commodities it actually handles.
WORDS: list[tuple[re.Pattern, list[str]]] = [
    (re.compile(r"\b(coffee\w*|caf[eé]s?|kaff\w*|koffie\w*|caff[eè]|torr[eé]fa\w*|r[oö]ster\w*|roast\w*|kaffebrenneri\w*|espresso)\b", re.I), COFFEE),
    (re.compile(r"\b(teas?|th[eé]s?|tee|thee|chai|matcha)\b", re.I), TEA),
    (re.compile(r"\b(spices?|[eé]pices?|gew[uü]rz\w*|krydder\w*|specerij\w*|spezie|especias?|peppers?|poivres?|pfeffer|vanill\w*|cinnamon|cannelle|zimt|cloves?|girofle|nutmeg|muscade|ginger|gingembre|ingwer|turmeric|curcuma|kurkuma|cardamom\w*)\b", re.I), SPICES),
    (re.compile(r"(cocoa|cacao|kakao|chocola\w*|schokola\w*|sjokolad\w*|cioccolat\w*)", re.I), COCOA),
    (re.compile(r"\b(fish\w*|poissons?|fisch\w*|fisk\w*|seafoods?|shrimps?|prawns?|crevettes?|garnelen?|reker|tuna|thon|thunfisch|mar[eé]e|crustac\w*|mollus\w*|sj[oø]mat)\b", re.I), SEAFOOD),
    (re.compile(r"\b(coconuts?|copra|kokos\w*|noix de coco)\b", re.I), ["0801", "1513"]),
    (re.compile(r"\b(palm oil|huile de palme|palm[oö]l|palmolje)\b", re.I), ["1511"]),
    (re.compile(r"\b(oils?|huiles?|[oö]le?|olje|oleo|ol[eé]agineux)\b", re.I), OILS),
    (re.compile(r"\b(sugars?|sucres?|zucker|sukker|suiker|az[uú]car)\b", re.I), ["1702"]),
    (re.compile(r"\b(seaweeds?|algues?|algen|zeewier|kelp|agar|carrag\w*)\b", re.I), ["1212"]),
    (re.compile(r"\b(essential oils?|huiles? essentielles?|[aä]therische\w*|patchouli)\b", re.I), ["3301"]),
    (re.compile(r"\b(rubber|caoutchouc|kautschuk|latex)\b", re.I), ["4001"]),
    (re.compile(r"\b(rattan|rotin|wicker|osier|baskets?|vannerie|korbwaren|flechtwaren)\b", re.I), ["4602"]),
    (re.compile(r"\b(furniture|meubles?|m[oö]bel\w*|m[oø]bler|meubel\w*|mobili|muebles)\b", re.I), ["9403"]),
    (re.compile(r"\b(pineapples?|ananas|tropical|tropique\w*|exotic|exotiques?|exotisch\w*|dried fruits?|fruits? secs)\b", re.I), ["2008"]),
]

# NACE class -> (default HS when the class is narrow, gate on words?, industry label, buyer_type)
NACE: dict[str, tuple[list[str], bool, str, str]] = {
    "46.37": (COFFEE + TEA + SPICES + COCOA, False, "coffee, tea, cocoa and spice wholesale", "wholesaler"),
    "10.83": (COFFEE + TEA, False, "coffee and tea processing", "processor"),
    "10.84": (SPICES, False, "spice and condiment processing", "processor"),
    "10.82": (COCOA, False, "cocoa and chocolate manufacturing", "manufacturer"),
    "46.36": (["1702"] + COCOA, True, "sugar, chocolate and confectionery wholesale", "wholesaler"),
    "46.38": (SEAFOOD, True, "fish, seafood and specialty food wholesale", "wholesaler"),
    "10.20": (SEAFOOD, False, "fish and seafood processing", "processor"),
    "10.41": (OILS, False, "oils and fats manufacturing", "processor"),
    "46.33": (OILS, True, "edible oils wholesale", "wholesaler"),
    "46.31": (["0801", "2008"], True, "fruit and vegetable wholesale", "wholesaler"),
    "10.39": (["2008"], True, "fruit and vegetable processing", "processor"),
    "20.53": (["3301"], False, "essential oils manufacturing", "manufacturer"),
    "22.19": (["4001"], False, "rubber products manufacturing", "manufacturer"),
    "22.11": (["4001"], False, "tyre and rubber manufacturing", "manufacturer"),
    "46.76": (["4001"], True, "intermediate products wholesale", "wholesaler"),
    "46.47": (["9403", "4602"], False, "furniture and home furnishing wholesale", "wholesaler"),
    "46.49": (["4602"], True, "household goods wholesale", "wholesaler"),
}


def nace_class(code: Optional[str]) -> Optional[str]:
    """'46370', '46.370', '46.37Z', '4637Z', '46.37' -> '46.37'."""
    if not code:
        return None
    d = re.sub(r"[^0-9]", "", str(code))
    if len(d) < 4:
        return None
    return f"{d[:2]}.{d[2:4]}"


def words_hs(*texts: Optional[str]) -> list[str]:
    blob = " ".join(t for t in texts if t)
    out: list[str] = []
    for rx, hs in WORDS:
        if rx.search(blob):
            out += [h for h in hs if h not in out]
    return out


def classify(codes: Iterable[Optional[str]], *texts: Optional[str]) -> Optional[dict]:
    """Returns {hs_codes, industry, buyer_type, nace} or None when the
    company is not a buyer of any target commodity."""
    named = words_hs(*texts)
    for code in codes:
        cls = nace_class(code)
        if not cls or cls not in NACE:
            continue
        default, gated, label, btype = NACE[cls]
        if gated:
            # Mixed class: keep only when the text names a commodity. 46.38
            # ("other food", incl. specialty/exotic wholesale) accepts any
            # named commodity; the others only their own.
            allowed = None if cls == "46.38" else set(default)
            hs = [h for h in named if allowed is None or h in allowed]
            if not hs:
                continue
        else:
            # Narrow class: narrow further by name when the name is explicit.
            hs = [h for h in named if h in default] or list(default)
        return {"hs_codes": hs, "industry": label, "buyer_type": btype, "nace": cls}
    return None


# Agence Bio publishes products as CPF codes (NACE-based product codes).
CPF: list[tuple[str, list[str]]] = [
    ("10.83.11", COFFEE), ("01.27", COFFEE + TEA), ("10.83.13", TEA), ("10.83.1", COFFEE + TEA),
    ("10.84.2", SPICES), ("01.28", SPICES), ("46.37", COFFEE + TEA + SPICES + COCOA), ("47.00.21", COFFEE + TEA + SPICES + COCOA),
    ("10.82.1", COCOA), ("10.82.2", COCOA), ("46.36.13", ["1804", "1805"]), ("01.27.20", COCOA),
    ("10.81", ["1702"]), ("46.36.11", ["1702"]),
    ("10.41.29", OILS), ("10.41.2", OILS), ("46.33.13", OILS), ("01.26", ["0801", "1513"]),
    ("20.53.1", ["3301"]), ("46.38.1", SEAFOOD), ("10.20", SEAFOOD), ("03.00.64", ["1212"]),
    ("10.39", ["2008"]), ("46.31.12", ["2008"]), ("01.22", ["0801", "2008"]),
]


def cpf_hs(codes: Iterable[str]) -> list[str]:
    out: list[str] = []
    for code in codes:
        for prefix, hs in CPF:
            if str(code).startswith(prefix):
                out += [h for h in hs if h not in out]
                break
    return out
