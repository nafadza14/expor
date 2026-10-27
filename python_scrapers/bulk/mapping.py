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
    (re.compile(r"\b(cashews?|cajou|areca|betel|candlenuts?|nuts?|noix|n[uü]sse|nötter|noten)\b", re.I), ["0801", "0802"]),
    (re.compile(r"\b(konjac|glucomannan|cassava|manioc|maniok|yams?|tubers?)\b", re.I), ["0714"]),
    (re.compile(r"\b(tapioca|tapioka|starch\w*|amidon|st[aä]rke)\b", re.I), ["1108"]),
    (re.compile(r"\b(bird'?s? ?nests?|swiftlet|nid d'hirondelle)\b", re.I), ["0410"]),
    (re.compile(r"\b(squid|calamar\w*|octopus|poulpe|tintenfisch|cuttlefish|seiche|blæksprutte|blekksprut)\b", re.I), ["0307"]),
    (re.compile(r"\b(crab\w*|crabes?|krabben?|krabbe|surimi)\b", re.I), ["1605", "0306"]),
    (re.compile(r"\b(agarwood|oud|aloeswood|herbs?|herbal|kr[aä]uter|plantes? m[eé]dicinales?|botanicals?)\b", re.I), ["1211"]),
    (re.compile(r"\b(resins?|r[eé]sines?|harz\w*|gums?|gommes?|benzoin|damar|copal|incense|encens|weihrauch)\b", re.I), ["1301"]),
    (re.compile(r"\b(gambier|catechu|tannins?|tanning)\b", re.I), ["3201"]),
    (re.compile(r"\b(coir|coco ?peat|substrat\w*|substrate\w*|potting soil|growing media|terreau)\b", re.I), ["5305"]),
    (re.compile(r"\b(charcoal|charbon de bois|holzkohle|briquet\w*|shisha|hookah|grillkohle)\b", re.I), ["4402"]),
    (re.compile(r"\b(activated carbon|charbon actif|aktivkohle|active carbon)\b", re.I), ["3802"]),
    (re.compile(r"\b(plywood|contreplaqu[eé]|sperrholz|timber|lumber|wood|bois|holz\w*|hout|tre)\b", re.I), ["4412"]),
    (re.compile(r"\b(handicrafts?|artisanat|kunsthandwerk|crafts?|home ?decor|d[eé]coration|deko\w*|gifts?|cadeaux?|geschenk\w*)\b", re.I), ["4421", "4602", "6912"]),
    (re.compile(r"\b(apparel|garments?|clothing|fashion|textil\w*|v[eê]tements?|bekleidung|mode|kl[aæ]r|kleding|t-?shirts?|knitwear)\b", re.I), ["6109", "6204"]),
    (re.compile(r"\b(fabrics?|tissus?|stoffe?|cotton|coton|baumwolle|batik)\b", re.I), ["5208"]),
    (re.compile(r"\b(footwear|shoes?|chaussures?|schuh\w*|sko|schoenen|sneakers?|boots?)\b", re.I), ["6404", "6403"]),
    (re.compile(r"\b(bags?|handbags?|sacs?|maroquinerie|taschen|lederwaren|luggage|bagages?|koffer)\b", re.I), ["4202"]),
    (re.compile(r"\b(cigars?|cigares?|zigarren?|tobacco|tabac|tabak|cigarettes?)\b", re.I), ["2402"]),
    (re.compile(r"\b(noodles?|nouilles?|nudeln|asian food|asia ?food|oriental food|ethnic food|[eé]picerie asiatique|asiatische)\b", re.I), ["1902", "2106"]),
    (re.compile(r"\b(biscuits?|wafers?|cookies?|kekse?|snacks?|crackers?|confiserie|s[uü]sswaren|confectionery)\b", re.I), ["1905"]),
    (re.compile(r"\b(mangos?|mangoes|mangues?|mangosteens?|bananas?|bananes?|fruits? exotiques|fresh produce|fruit|fruits|obst)\b", re.I), ["0804", "0803"]),
    (re.compile(r"\b(cosmetics?|cosm[eé]ti\w*|kosmeti\w*|beauty|beaut[eé]|skin ?care|soins?|perfum\w*|parfum\w*)\b", re.I), ["3304"]),
    (re.compile(r"\b(soaps?|savons?|seifen?|s[aå]pe)\b", re.I), ["3401"]),
    (re.compile(r"\b(jewell?ery|jewelry|bijoux|bijouterie|schmuck|smykker|sieraden|silver|argent|silber)\b", re.I), ["7113"]),
    (re.compile(r"\b(ceramics?|c[eé]ramiques?|keramik\w*|pottery|poterie|porcelain|porcelaine|porzellan|stoneware|tableware|vaisselle|geschirr)\b", re.I), ["6912"]),
    (re.compile(r"\b(chairs?|chaises?|st[uü]hle|sofas?|seating|garden furniture|outdoor furniture|gartenm[oö]bel|mobilier de jardin)\b", re.I), ["9401", "9403"]),
    (re.compile(r"\b(gloves?|gants?|handschuh\w*|hansker)\b", re.I), ["4015"]),
    (re.compile(r"\b(tyres?|tires?|pneus?|pneumatiques?|reifen|dekk)\b", re.I), ["4011"]),
]

# NACE class -> (default HS when the class is narrow, gate on words?, industry label, buyer_type)
NACE: dict[str, tuple[list[str], bool, str, str]] = {
    "46.37": (COFFEE + TEA + SPICES + COCOA, False, "coffee, tea, cocoa and spice wholesale", "wholesaler"),
    "10.83": (COFFEE + TEA, False, "coffee and tea processing", "processor"),
    "10.84": (SPICES, False, "spice and condiment processing", "processor"),
    "10.82": (COCOA, False, "cocoa and chocolate manufacturing", "manufacturer"),
    "46.36": (["1702"] + COCOA, True, "sugar, chocolate and confectionery wholesale", "wholesaler"),
    "46.38": (SEAFOOD + ["0307", "1605", "1212", "0801", "0802", "1513", "0410", "1902", "1905", "2106", "1108", "1702", "0714", "2008"] + COFFEE + TEA + SPICES + COCOA,
              True, "fish, seafood and specialty food wholesale", "wholesaler"),
    "10.20": (SEAFOOD, False, "fish and seafood processing", "processor"),
    "10.41": (OILS, False, "oils and fats manufacturing", "processor"),
    "46.33": (OILS, True, "edible oils wholesale", "wholesaler"),
    "46.31": (["0801", "0802", "2008", "0804", "0803", "0714"], True, "fruit and vegetable wholesale", "wholesaler"),
    "10.39": (["2008"], True, "fruit and vegetable processing", "processor"),
    "20.53": (["3301"], False, "essential oils manufacturing", "manufacturer"),
    "22.19": (["4001"], False, "rubber products manufacturing", "manufacturer"),
    "22.11": (["4001"], False, "tyre and rubber manufacturing", "manufacturer"),
    "46.76": (["4001"], True, "intermediate products wholesale", "wholesaler"),
    "46.47": (["9403", "4602"], False, "furniture and home furnishing wholesale", "wholesaler"),
    "46.49": (["4602", "4421", "6912", "4202"], True, "household goods wholesale", "wholesaler"),
    "46.42": (["6109", "6204", "6404", "6403", "4202"], False, "clothing and footwear wholesale", "wholesaler"),
    "46.41": (["5208"], False, "textiles wholesale", "wholesaler"),
    "46.48": (["7113"], False, "watches and jewellery wholesale", "wholesaler"),
    "46.45": (["3304", "3401", "3301"], False, "perfume and cosmetics wholesale", "wholesaler"),
    "46.44": (["6912", "3401"], True, "china, glassware and cleaning products wholesale", "wholesaler"),
    "46.35": (["2402"], False, "tobacco products wholesale", "wholesaler"),
    "46.39": (SEAFOOD + ["1902", "1905", "2106", "0410", "1108", "0801", "1702"], True, "food wholesale", "wholesaler"),
    "46.73": (["4412", "4011"], True, "wood and construction materials wholesale", "wholesaler"),
    "46.75": (["3802", "1301", "3201", "1108", "3301"], True, "chemical products wholesale", "wholesaler"),
    "46.21": (["0802", "0714", "5305", "1211", "0801"], True, "agricultural raw materials wholesale", "wholesaler"),
    "46.46": (["4015", "1211"], True, "pharmaceutical and medical goods wholesale", "wholesaler"),
    "46.71": (["4402"], True, "solid fuels wholesale", "wholesaler"),
    "45.31": (["4011"], True, "motor vehicle parts wholesale", "wholesaler"),
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
            # Mixed class: keep only when the text names one of its commodities.
            hs = [h for h in named if h in default]
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


# ---------------------------------------------------------------- NAICS (US)
# 6-digit NAICS (2017/2022) -> (default HS, gated, industry, buyer_type).
FOOD_ANY = SEAFOOD + ["0307", "1605", "1212", "0801", "0802", "1513", "1511", "0410", "1902", "1905", "2106", "1108",
                      "1702", "0714", "2008", "0804", "0803"] + COFFEE + TEA + SPICES + COCOA
NAICS: dict[str, tuple[list[str], bool, str, str]] = {
    "424490": (FOOD_ANY, True, "specialty food wholesale", "wholesaler"),
    "424410": (FOOD_ANY, True, "grocery wholesale", "wholesaler"),
    "424420": (SEAFOOD + ["0307", "1605", "2008"], True, "frozen food wholesale", "wholesaler"),
    "424460": (SEAFOOD + ["0307", "1605"], False, "fish and seafood wholesale", "wholesaler"),
    "424480": (["0804", "0803", "0714", "0801"], False, "fresh fruit and vegetable wholesale", "wholesaler"),
    "424450": (["1905"] + COCOA + ["1702"], True, "confectionery wholesale", "wholesaler"),
    "424590": (["0802", "5305", "1211", "1301", "0801", "4001"], True, "farm product raw materials wholesale", "wholesaler"),
    "424690": (["3802", "1301", "3201", "1108", "3301"], True, "chemical products wholesale", "wholesaler"),
    "424210": (["3304", "3401", "4015", "1211", "3301"], True, "drugs, cosmetics and sundries wholesale", "wholesaler"),
    "424310": (["5208"], False, "piece goods and fabrics wholesale", "wholesaler"),
    "424320": (["6109", "6204"], False, "clothing wholesale", "wholesaler"),
    "424330": (["6109", "6204"], False, "clothing wholesale", "wholesaler"),
    "424350": (["6109", "6204", "4202"], False, "clothing and accessories wholesale", "wholesaler"),
    "424340": (["6404", "6403"], False, "footwear wholesale", "wholesaler"),
    "423210": (["9403", "9401", "4602"], False, "furniture wholesale", "wholesaler"),
    "423220": (["6912", "4602", "4421", "9403"], True, "home furnishing wholesale", "wholesaler"),
    "423940": (["7113"], False, "jewellery wholesale", "wholesaler"),
    "424940": (["2402"], False, "tobacco products wholesale", "wholesaler"),
    "423310": (["4412"], False, "lumber and plywood wholesale", "wholesaler"),
    "423130": (["4011"], False, "tire wholesale", "wholesaler"),
    "423990": (["4421", "4602", "4402", "6912"], True, "miscellaneous goods wholesale", "wholesaler"),
    "311920": (COFFEE + TEA, False, "coffee and tea manufacturing", "processor"),
    "311942": (SPICES, False, "spice and extract manufacturing", "processor"),
    "311351": (COCOA, False, "chocolate manufacturing", "manufacturer"),
    "311352": (COCOA, False, "confectionery from purchased chocolate", "manufacturer"),
    "311710": (SEAFOOD + ["0307", "1605"], False, "seafood processing", "processor"),
    "311225": (OILS, False, "fats and oils refining", "processor"),
    "325620": (["3301", "1513"], False, "cosmetics and toiletries manufacturing", "manufacturer"),
}


def classify_naics(codes: Iterable[Optional[str]], *texts: Optional[str]) -> Optional[dict]:
    named = words_hs(*texts)
    for code in codes:
        d = re.sub(r"[^0-9]", "", str(code or ""))[:6]
        if d not in NAICS:
            continue
        default, gated, label, btype = NAICS[d]
        hs = [h for h in named if h in default] or ([] if gated else list(default))
        if hs:
            return {"hs_codes": hs, "industry": label, "buyer_type": btype, "nace": f"NAICS {d}"}
    return None


# ------------------------------------------------- name only (no activity code)
# Registries without activity codes (Australia, city lists without NAICS):
# a company is kept only if its name names a commodity AND says it trades.
TRADE = re.compile(r"\b(import\w*|export\w*|trad(e|es|er|ers|ing)|wholesal\w*|distribut\w*|merchants?|suppl(y|ies|iers?)|roast\w*|sourcing|commodit\w*|brokers?)\b", re.I)
STRONG = re.compile(r"\b(import\w*|wholesal\w*|distribut\w*|export\w*)\b", re.I)
# Commodity words that are unambiguous in a company name. Anything else
# ("oil", "nuts", "gum", "wood", "fashion", "gifts", "beauty", "fish") also
# means other trades, so it needs an explicit import/wholesale word.
SPECIFIC = re.compile(
    r"\b(coffee\w*|kaffee|cafe|tea|teas|spices?|pepper|vanill\w*|cinnamon|cloves?|nutmeg|ginger|turmeric|cardamom|"
    r"cocoa|cacao|chocolat\w*|coconuts?|copra|kokos\w*|cashews?|areca|betel|candlenuts?|coir|coco ?peat|"
    r"palm oil|essential oils?|patchouli|seaweeds?|agar|carrageenan|rattan|wicker|batik|kretek|cigars?|"
    r"bird'?s? ?nests?|swiftlet|konjac|glucomannan|tapioca|cassava|agarwood|oud|charcoal|briquet\w*|shisha|"
    r"shrimps?|prawns?|squid|octopus|crab\w*|tuna|seafoods?|rubber|latex|plywood|teak|cocopeat|noodles?|asian foods?|oriental foods?)\b",
    re.I)
WEAK_ONLY = set()  # kept for compatibility


def classify_name(name: Optional[str], *texts: Optional[str]) -> Optional[dict]:
    if not name or not TRADE.search(name):
        return None
    hs = words_hs(name, *texts)
    if not hs:
        return None
    if not (SPECIFIC.search(name) or STRONG.search(name)):
        return None
    btype = "importer" if re.search(r"\bimport", name, re.I) else "trader"
    return {"hs_codes": hs, "industry": "importer / trader (by company name)", "buyer_type": btype, "nace": None}
