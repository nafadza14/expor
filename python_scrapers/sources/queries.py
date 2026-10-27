"""Search queries that lead to LISTS of buyers, in the languages of the
target markets. The discovery job walks through them, gap-first (the
commodity x country pairs with the fewest buyers), and never repeats a
query it has already run.
"""

from __future__ import annotations
import datetime as _dt
from typing import Iterator

from ..shared.commodities import commodities, countries

YEAR = _dt.date.today().year

LANG = {
    "DE": "de", "AT": "de", "CH": "de", "FR": "fr", "BE": "fr", "NL": "nl", "ES": "es", "MX": "es",
    "IT": "it", "PT": "pt", "BR": "pt", "JP": "ja", "KR": "ko", "CN": "zh", "TW": "zh", "AE": "ar",
    "SA": "ar", "EG": "ar", "TR": "tr", "PL": "pl", "SE": "sv", "DK": "da", "NO": "no",
}

# Commodity words in the local language (first English keyword is the key).
LOCAL = {
    "coffee": {"de": "Kaffee", "fr": "café", "nl": "koffie", "es": "café", "it": "caffè", "pt": "café", "ja": "コーヒー", "ko": "커피", "zh": "咖啡", "ar": "البن", "tr": "kahve", "pl": "kawa", "sv": "kaffe", "da": "kaffe", "no": "kaffe"},
    "tea": {"de": "Tee", "fr": "thé", "nl": "thee", "es": "té", "it": "tè", "ja": "紅茶", "zh": "茶叶", "ar": "الشاي", "tr": "çay", "pl": "herbata"},
    "pepper": {"de": "Gewürze", "fr": "épices", "nl": "specerijen", "es": "especias", "it": "spezie", "ja": "香辛料", "zh": "香料", "ar": "التوابل", "tr": "baharat", "pl": "przyprawy"},
    "vanilla": {"de": "Vanille", "fr": "vanille", "nl": "vanille", "es": "vainilla", "it": "vaniglia", "ja": "バニラ", "zh": "香草", "ar": "الفانيليا"},
    "cinnamon": {"de": "Zimt", "fr": "cannelle", "nl": "kaneel", "es": "canela", "ja": "シナモン", "zh": "肉桂"},
    "cloves": {"de": "Nelken", "fr": "clou de girofle", "es": "clavo", "ja": "クローブ", "zh": "丁香"},
    "nutmeg": {"de": "Muskatnuss", "fr": "noix de muscade", "es": "nuez moscada", "zh": "肉豆蔻"},
    "ginger": {"de": "Ingwer", "fr": "gingembre", "nl": "gember", "es": "jengibre", "ja": "生姜", "zh": "生姜"},
    "coconut": {"de": "Kokos", "fr": "noix de coco", "nl": "kokos", "es": "coco", "it": "cocco", "ja": "ココナッツ", "zh": "椰子", "ar": "جوز الهند"},
    "coconut oil": {"de": "Kokosöl", "fr": "huile de coco", "nl": "kokosolie", "es": "aceite de coco", "ja": "ココナッツオイル", "zh": "椰子油"},
    "palm oil": {"de": "Palmöl", "fr": "huile de palme", "nl": "palmolie", "es": "aceite de palma", "zh": "棕榈油", "ar": "زيت النخيل", "tr": "palm yağı"},
    "cocoa beans": {"de": "Kakao", "fr": "cacao", "nl": "cacao", "es": "cacao", "it": "cacao", "ja": "カカオ", "zh": "可可", "tr": "kakao"},
    "shrimp": {"de": "Garnelen", "fr": "crevettes", "nl": "garnalen", "es": "camarón", "it": "gamberi", "ja": "エビ", "ko": "새우", "zh": "虾", "ar": "الروبيان"},
    "frozen fish": {"de": "Tiefkühlfisch", "fr": "poisson surgelé", "nl": "diepvriesvis", "es": "pescado congelado", "ja": "冷凍魚", "zh": "冷冻鱼"},
    "seaweed": {"de": "Algen", "fr": "algues", "nl": "zeewier", "es": "algas", "ja": "海藻", "ko": "해조류", "zh": "海藻"},
    "essential oil": {"de": "ätherische Öle", "fr": "huiles essentielles", "nl": "etherische oliën", "es": "aceites esenciales", "ja": "精油", "zh": "精油"},
    "natural rubber": {"de": "Naturkautschuk", "fr": "caoutchouc naturel", "es": "caucho natural", "ja": "天然ゴム", "zh": "天然橡胶", "tr": "doğal kauçuk"},
    "wooden furniture": {"de": "Möbel", "fr": "meubles", "nl": "meubelen", "es": "muebles", "it": "mobili", "ja": "家具", "ko": "가구", "zh": "家具", "ar": "الأثاث", "pl": "meble"},
    "rattan": {"de": "Rattanmöbel", "fr": "rotin", "nl": "rotan", "es": "ratán", "ja": "ラタン", "zh": "藤制品"},
    "cashew": {"de": "Cashewkerne", "fr": "noix de cajou", "nl": "cashewnoten", "es": "anacardo", "ja": "カシューナッツ", "zh": "腰果"},
    "charcoal briquettes": {"de": "Holzkohle", "fr": "charbon de bois", "nl": "houtskool", "es": "carbón vegetal", "ar": "فحم الشيشة", "tr": "nargile kömürü"},
    "t-shirts": {"de": "Bekleidung", "fr": "vêtements", "nl": "kleding", "es": "ropa", "ja": "アパレル", "zh": "服装"},
    "sneakers": {"de": "Schuhe", "fr": "chaussures", "nl": "schoenen", "es": "calzado", "ja": "靴", "zh": "鞋"},
}

# "{kw}" commodity word, "{country}" country name, "{y}" year.
TEMPLATES = {
    "en": ["list of {kw} importers in {country}", "{kw} importers directory {country}", "{kw} importers list pdf {country}",
           "{kw} association member companies {country}", "{kw} trade association members list {country}",
           "{kw} exhibitors list {y} trade fair {country}", "{kw} buyers list {country} embassy trade section",
           "{kw} wholesalers and distributors directory {country}"],
    "id": ["daftar importir {kw} di {country}", "daftar buyer {kw} {country} pdf", "daftar importir {kw} ITPC {country}"],
    "de": ["Liste {kw} Importeure Deutschland", "{kw} Verband Mitglieder", "Mitgliederverzeichnis {kw} Großhandel", "{kw} Importeure Aussteller Messe {y}"],
    "fr": ["liste des importateurs de {kw}", "annuaire des membres {kw} syndicat", "exposants {kw} salon {y}", "importateurs {kw} annuaire"],
    "nl": ["lijst importeurs {kw}", "leden {kw} vereniging", "{kw} importeurs groothandel overzicht"],
    "es": ["lista de importadores de {kw}", "directorio de socios {kw} asociación", "importadores de {kw} directorio"],
    "it": ["elenco importatori {kw}", "soci associazione {kw}", "importatori {kw} elenco aziende"],
    "pt": ["lista de importadores de {kw}", "associados associação {kw}"],
    "ja": ["{kw} 輸入業者 一覧", "{kw} 協会 会員名簿", "{kw} 輸入商社 一覧"],
    "ko": ["{kw} 수입업체 목록", "{kw} 협회 회원사"],
    "zh": ["{kw} 进口商 名单", "{kw} 协会 会员单位"],
    "ar": ["قائمة مستوردي {kw}", "دليل مستوردي {kw}"],
    "tr": ["{kw} ithalatçıları listesi", "{kw} derneği üyeleri"],
    "pl": ["lista importerów {kw}", "{kw} członkowie stowarzyszenia"],
    "sv": ["{kw} importörer lista"], "da": ["{kw} importører liste"], "no": ["{kw} importører liste"],
}

ID_COUNTRY = {"US": "Amerika Serikat", "DE": "Jerman", "NL": "Belanda", "JP": "Jepang", "GB": "Inggris", "FR": "Prancis",
              "AU": "Australia", "AE": "Uni Emirat Arab", "SA": "Arab Saudi", "KR": "Korea Selatan", "CN": "Tiongkok",
              "IT": "Italia", "BE": "Belgia", "ES": "Spanyol", "CA": "Kanada", "SG": "Singapura", "MY": "Malaysia",
              "IN": "India", "TW": "Taiwan", "TR": "Turki", "EG": "Mesir", "CH": "Swiss", "PL": "Polandia"}


def candidates(coverage: dict[tuple[str, str], int]) -> Iterator[dict]:
    """Yields {query, hs4, country, lang}, the thinnest (hs4, country) first."""
    coms = commodities(3)
    cos = countries(3)
    pairs = sorted(((c, k) for c in coms for k in cos),
                   key=lambda p: (coverage.get((p[0]["hs4"], p[1]["iso2"]), 0), int(p[0].get("priority", 2)), int(p[1].get("priority", 2))))
    for com, co in pairs:
        en_kw = (com.get("keywords") or [com["label_en"]])[0]
        iso = co["iso2"]
        lang = LANG.get(iso)
        out = []
        for t in TEMPLATES["en"]:
            out.append((t.format(kw=en_kw, country=co["name"], y=YEAR), "en"))
        local_kw = (LOCAL.get(en_kw) or {}).get(lang or "")
        if lang and local_kw:
            for t in TEMPLATES.get(lang, []):
                out.append((t.format(kw=local_kw, country=co["name"], y=YEAR), lang))
        idc = ID_COUNTRY.get(iso)
        if idc:
            for t in TEMPLATES["id"]:
                out.append((t.format(kw=com["label_id"].split(" (")[0].lower(), country=idc, y=YEAR), "id"))
        for q, lg in out:
            yield {"query": q, "hs4": com["hs4"], "country": iso, "lang": lg}
