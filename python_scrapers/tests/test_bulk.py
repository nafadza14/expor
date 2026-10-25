"""Bulk importers: parsing and mapping, no network or database."""
import os, io, csv, zipfile, tempfile
from python_scrapers.bulk import uk_companies_house as uk, fr_sirene as fr, no_brreg as no, fr_agencebio as bio, osm
from python_scrapers.bulk.writer import tidy_name, norm_website, norm_email


def ok(c, m, d=""):
    assert c, f"{m}: {d}"


def test_bulk_sources():
    # --- UK
    hdr = ['CompanyName', ' CompanyNumber', 'RegAddress.CareOf', 'RegAddress.POBox', 'RegAddress.AddressLine1', ' RegAddress.AddressLine2', 'RegAddress.PostTown', 'RegAddress.County', 'RegAddress.Country', 'RegAddress.PostCode', 'CompanyCategory', 'CompanyStatus', 'CountryOfOrigin', 'DissolutionDate', 'IncorporationDate', 'SICCode.SicText_1', 'SICCode.SicText_2', 'SICCode.SicText_3', 'SICCode.SicText_4', 'URI']
    rows = [
     ['BRISTOL COFFEE IMPORTERS LTD', '01234567', '', '', '1 HIGH ST', '', 'BRISTOL', '', 'ENGLAND', 'BS1 1AA', 'Private Limited Company', 'Active', 'United Kingdom', '', '01/01/2010', '46370 - Wholesale of coffee, tea, cocoa and spices', '', '', '', 'http://x'],
     ['DEAD SPICE LTD', '02', '', '', '', '', 'LEEDS', '', '', '', '', 'Dissolved', '', '', '', '46370 - Wholesale of coffee, tea, cocoa and spices', '', '', '', ''],
     ['RANDOM CONSULTING LTD', '03', '', '', '', '', 'LONDON', '', '', '', '', 'Active', '', '', '', '70229 - Management consultancy', '', '', '', ''],
     ['OCEAN PRAWN TRADERS LTD', '04', '', '', '5 DOCK RD', '', 'GRIMSBY', '', '', 'DN1', '', 'Active', '', '', '', '46380 - Wholesale of other food, including fish, crustaceans and molluscs', '', '', '', ''],
     ['GENERIC FOODS LTD', '05', '', '', '', '', 'HULL', '', '', '', '', 'Active', '', '', '', '46380 - Wholesale of other food, including fish, crustaceans and molluscs', '', '', '', ''],
    ]
    buf = io.StringIO(); w = csv.writer(buf); w.writerow(hdr); w.writerows(rows)
    ZIP = os.path.join(tempfile.mkdtemp(), 'ch.zip')
    with zipfile.ZipFile(ZIP, 'w') as z: z.writestr('BasicCompanyDataAsOneFile-2026-10-01.csv', buf.getvalue())
    recs = list(uk.parse(ZIP))
    ok([r['source_id'] for r in recs] == ['01234567', '04'], 'UK keeps active buyer classes only', recs)
    ok(recs[0]['hs_codes'] == ['0901', '2101'] and recs[0]['city'] == 'Bristol', 'UK coffee name narrows HS', recs[0])
    ok(uk.find_zip_url('<a href="BasicCompanyDataAsOneFile-2026-09-01.zip">x</a><a href="BasicCompanyDataAsOneFile-2026-10-01.zip">') == 'https://download.companieshouse.gov.uk/BasicCompanyDataAsOneFile-2026-10-01.zip', 'UK finds latest zip')

    # --- SIRENE
    class FakeSirene:
        def __init__(self, n): self.n = n; self.calls = []
        def get(self, p):
            self.calls.append(p)
            per = p['per_page']; page = p['page']
            if per == 1: return {'total_results': self.n, 'results': [{}], 'total_pages': self.n}
            tot = self.n if 'departement' not in p else 30
            start = (page - 1) * per
            res = [{'siren': f'{p.get("departement","x")}{i:06d}', 'nom_complet': f'CAFE IMPORT {i}', 'nature_juridique': '5710',
                    'siege': {'activite_principale': '46.37Z', 'libelle_commune': 'LYON', 'adresse': '1 RUE X 69001 LYON'}, 'tranche_effectif_salarie': '11'}
                   for i in range(start, min(start + per, tot))]
            return {'results': res, 'total_pages': -(-tot // per), 'total_results': tot}
    fs = FakeSirene(60)
    got = list(fr.companies(fs, '46.37Z'))
    ok(len(got) == 60, 'SIRENE walks all pages', len(got))
    fs2 = FakeSirene(12000)
    got2 = list(fr.companies(fs2, '46.37Z'))
    ok(len(got2) == 30 * len(fr.DEPARTEMENTS) and any('departement' in c for c in fs2.calls), 'SIRENE splits >10k by departement', len(got2))
    r = fr.to_record(got[0], '46.37Z')
    ok(r and r['hs_codes'] == ['0901', '2101'] and r['size_bucket'] == 'medium' and r['city'] == 'Lyon', 'SIRENE record', r)
    ok(fr.to_record({**got[0], 'nature_juridique': '1000'}, '46.37Z') is None, 'SIRENE drops sole traders')

    # --- Brreg
    e = {"aktivitet": ["Import av kaffeprodukter. Primært kaffebønner."], "forretningsadresse": {"adresse": ["Gustav Jensens gate 3"], "postnummer": "0461", "poststed": "OSLO"},
         "naeringskode1": {"kode": "46.370"}, "navn": "MAGNAT KAFFEHUS AS", "organisasjonsform": {"kode": "AS"}, "organisasjonsnummer": "918541934",
         "epostadresse": "post@magnatkaffehus.no", "hjemmeside": "www.magnatkaffehus.no", "mobil": "917 10 345", "antallAnsatte": 4}
    r = no.to_record(e)
    ok(r and r['hs_codes'] == ['0901', '2101'] and r['website'] == 'www.magnatkaffehus.no' and r['size_bucket'] == 'small', 'Brreg record', r)
    ok(no.to_record({**e, 'organisasjonsform': {'kode': 'ENK'}}) is None, 'Brreg drops ENK')
    ok(no.to_record({**e, 'naeringskode1': {'kode': '46.380'}, 'navn': 'NORSK MAT AS', 'aktivitet': ['Engros']}) is None, 'Brreg gated class needs commodity word')

    # --- Agence BIO
    o = {"id": 1, "raisonSociale": "EXOTIC BIO IMPORT", "denominationcourante": None, "numeroBio": 99, "telephone": "04 75 00 00 00", "siteWebs": [{"url": "https://www.exoticbio.fr", "typeSiteWeb": {"nom": "Site Officiel"}}],
         "adressesOperateurs": [{"lieu": "LES CROS", "codePostal": "26120", "ville": "MONTMEYRAN", "pays": "FRANCE", "typeAdresseOperateurs": ["Siège social"]}],
         "productions": [{"code": "46.37.1", "nom": "Commerce de gros de café, thé, cacao et épices"}, {"code": "10.84.2", "nom": "Épices préparées"}],
         "activites": [{"nom": "Importation"}], "certificats": [{"etatCertification": "ENGAGEE", "organisme": "Ecocert France", "url": "http://certificat.ecocert.com/x", "numeroControleEu": "FR-BIO-01"}]}
    r = bio.to_record(o)
    ok(r and '0904' in r['hs_codes'] and r['website'] == 'https://www.exoticbio.fr' and r['buyer_type'] == 'importer', 'Agence BIO record', r)
    ok(bio.to_record({**o, 'certificats': [{"etatCertification": "ARRETEE"}]}) is None, 'Agence BIO drops stopped certificates')
    ok(bio.to_record({**o, 'raisonSociale': '0000', 'productions': []}) is None, 'Agence BIO drops placeholder names')

    # --- OSM
    el = {"type": "node", "id": 42, "tags": {"name": "Rösterei Hamburg", "craft": "coffee_roaster", "website": "https://roesterei.de/kontakt", "email": "info@roesterei.de", "phone": "+49 40 1234567", "addr:city": "Hamburg", "addr:street": "Hafenstr", "addr:housenumber": "1"}}
    r = osm.to_record(el, 'DE')
    ok(r and r['hs_codes'] == ['0901', '2101'] and r['email'] == 'info@roesterei.de', 'OSM roaster', r)
    ok(osm.to_record({"type": "node", "id": 3, "tags": {"name": "Cafe X", "shop": "coffee", "amenity": "cafe"}}, 'DE') is None, 'OSM drops cafes')
    ok('nwr["craft"="coffee_roaster"]["name"](area.c);' in osm.query('DE'), 'OSM query')

    # --- helpers
    ok(tidy_name('KAFFEE HAUS GMBH') == 'Kaffee Haus GmbH' and tidy_name('BRISTOL COFFEE IMPORTERS LTD') == 'Bristol Coffee Importers Ltd', 'tidy name', tidy_name('KAFFEE HAUS GMBH'))
    ok(norm_website('www.Shop.de/abc') == 'https://www.shop.de' and norm_website('facebook.com/x') is None, 'website norm')
    ok(norm_email('Info@Shop.de') == ('info@shop.de', 'role') and norm_email('a@gmail.com')[1] == 'freemail', 'email norm')


