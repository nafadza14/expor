// EksporIn — deterministic demo-data seeder
'use strict';
const { scryptSync, randomBytes } = require('node:crypto');

// ---------- deterministic PRNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260707);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const ri = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const rf = (min, max) => min + rnd() * (max - min);

// ---------- HS taxonomy (chapters relevant to Indonesian exports) ----------
const HS = [
  ['03', null, 2, 'Fish and crustaceans, molluscs', 'Ikan dan udang, moluska'],
  ['0303', '03', 4, 'Fish, frozen (excl. fillets)', 'Ikan beku (selain filet)'],
  ['030343', '0303', 6, 'Skipjack / stripe-bellied bonito, frozen', 'Cakalang beku'],
  ['030389', '0303', 6, 'Other fish, frozen', 'Ikan beku lainnya'],
  ['0306', '03', 4, 'Crustaceans', 'Krustasea (udang, kepiting)'],
  ['030616', '0306', 6, 'Cold-water shrimps and prawns, frozen', 'Udang air dingin beku'],
  ['030617', '0306', 6, 'Other shrimps and prawns, frozen', 'Udang beku lainnya'],
  ['09', null, 2, 'Coffee, tea, mate and spices', 'Kopi, teh, dan rempah-rempah'],
  ['0901', '09', 4, 'Coffee, whether or not roasted', 'Kopi, disangrai maupun tidak'],
  ['090111', '0901', 6, 'Coffee, not roasted, not decaffeinated', 'Kopi biji, belum disangrai, tidak dekafeinasi'],
  ['090121', '0901', 6, 'Coffee, roasted, not decaffeinated', 'Kopi sangrai, tidak dekafeinasi'],
  ['0904', '09', 4, 'Pepper; dried capsicum', 'Lada; cabai kering'],
  ['090411', '0904', 6, 'Pepper, neither crushed nor ground', 'Lada utuh'],
  ['0908', '09', 4, 'Nutmeg, mace and cardamoms', 'Pala, fuli, dan kapulaga'],
  ['090811', '0908', 6, 'Nutmeg, neither crushed nor ground', 'Pala utuh'],
  ['15', null, 2, 'Animal or vegetable fats and oils', 'Lemak dan minyak hewani/nabati'],
  ['1513', '15', 4, 'Coconut, palm kernel or babassu oil', 'Minyak kelapa / inti sawit'],
  ['151311', '1513', 6, 'Coconut (copra) oil, crude', 'Minyak kelapa mentah'],
  ['16', null, 2, 'Preparations of meat or fish', 'Olahan daging atau ikan'],
  ['1604', '16', 4, 'Prepared or preserved fish', 'Ikan olahan atau diawetkan'],
  ['160414', '1604', 6, 'Tunas, skipjack, prepared/preserved', 'Tuna/cakalang olahan (kaleng)'],
  ['1605', '16', 4, 'Crustaceans, prepared or preserved', 'Krustasea olahan'],
  ['160521', '1605', 6, 'Shrimps and prawns, not in airtight containers', 'Udang olahan (non-kaleng)'],
  ['40', null, 2, 'Rubber and articles thereof', 'Karet dan barang dari karet'],
  ['4001', '40', 4, 'Natural rubber', 'Karet alam'],
  ['400122', '4001', 6, 'Technically specified natural rubber (TSNR)', 'Karet alam spesifikasi teknis (TSNR/SIR)'],
  ['44', null, 2, 'Wood and articles of wood', 'Kayu dan barang dari kayu'],
  ['4412', '44', 4, 'Plywood, veneered panels', 'Kayu lapis, panel veneer'],
  ['441231', '4412', 6, 'Plywood of tropical wood', 'Kayu lapis kayu tropis'],
  ['46', null, 2, 'Basketware and wickerwork', 'Anyaman dan barang anyaman'],
  ['4602', '46', 4, 'Basketwork, wickerwork', 'Barang anyaman (rotan, bambu)'],
  ['460212', '4602', 6, 'Basketwork of rattan', 'Anyaman rotan'],
  ['94', null, 2, 'Furniture; bedding; lamps', 'Perabot; kasur; lampu'],
  ['9401', '94', 4, 'Seats and parts thereof', 'Tempat duduk dan bagiannya'],
  ['940161', '9401', 6, 'Seats with wooden frames, upholstered', 'Kursi rangka kayu, berlapis'],
  ['940169', '9401', 6, 'Seats with wooden frames, other', 'Kursi rangka kayu lainnya'],
  ['9403', '94', 4, 'Other furniture and parts thereof', 'Perabot lainnya dan bagiannya'],
  ['940330', '9403', 6, 'Wooden furniture for offices', 'Perabot kayu untuk kantor'],
  ['940350', '9403', 6, 'Wooden furniture for bedrooms', 'Perabot kayu untuk kamar tidur'],
  ['940360', '9403', 6, 'Other wooden furniture', 'Perabot kayu lainnya'],
];
const LEAF_HS = HS.filter((h) => h[2] === 6).map((h) => h[0]);

// product profile per 6-digit code: [industry, unit, kgPerUnit?, usdPerKg range, desc]
const HS_PROFILE = {
  '030343': ['Seafood', 'KG', [1.8, 3.2], 'FROZEN SKIPJACK TUNA WHOLE ROUND'],
  '030389': ['Seafood', 'KG', [2.0, 4.5], 'FROZEN FISH ASSORTED'],
  '030616': ['Seafood', 'KG', [7.5, 11.0], 'FROZEN COLD WATER SHRIMP'],
  '030617': ['Seafood', 'KG', [7.0, 12.5], 'FROZEN VANNAMEI SHRIMP HLSO'],
  '090111': ['Coffee', 'KG', [3.2, 6.8], 'GREEN COFFEE BEANS ARABICA GRADE 1'],
  '090121': ['Coffee', 'KG', [8.0, 15.0], 'ROASTED COFFEE BEANS'],
  '090411': ['Spices', 'KG', [4.5, 8.0], 'BLACK PEPPER WHOLE MUNTOK'],
  '090811': ['Spices', 'KG', [9.0, 14.0], 'NUTMEG WHOLE ABCD GRADE'],
  '151311': ['Agri-food', 'KG', [1.1, 1.9], 'CRUDE COCONUT OIL IN FLEXITANK'],
  '160414': ['Seafood', 'CTN', [4.0, 6.5], 'CANNED SKIPJACK TUNA IN BRINE'],
  '160521': ['Seafood', 'KG', [8.5, 13.0], 'COOKED PEELED SHRIMP FROZEN'],
  '400122': ['Rubber', 'KG', [1.4, 2.2], 'NATURAL RUBBER SIR 20 IN PALLETS'],
  '441231': ['Wood products', 'M3', [480, 720], 'TROPICAL HARDWOOD PLYWOOD PANELS'],
  '460212': ['Home & living', 'CTN', [6.0, 14.0], 'RATTAN BASKETS HANDMADE ASSORTED'],
  '940161': ['Furniture', 'PCS', [18, 42], 'UPHOLSTERED TEAK FRAME ARMCHAIRS'],
  '940169': ['Furniture', 'PCS', [14, 35], 'WOODEN DINING CHAIRS KNOCK DOWN'],
  '940330': ['Furniture', 'PCS', [25, 60], 'WOODEN OFFICE DESKS'],
  '940350': ['Furniture', 'PCS', [30, 75], 'TEAK BEDROOM SETS'],
  '940360': ['Furniture', 'PCS', [20, 55], 'MAHOGANY SIDE TABLES AND CABINETS'],
};

// ---------- geography ----------
const COUNTRIES = {
  US: { name: 'Amerika Serikat', ports: ['Los Angeles, CA', 'Long Beach, CA', 'New York/Newark, NJ', 'Seattle, WA', 'Savannah, GA', 'Houston, TX', 'Oakland, CA'], cities: ['Los Angeles', 'Seattle', 'New York', 'Chicago', 'Houston', 'Miami', 'Portland', 'San Francisco', 'Atlanta', 'Dallas'] },
  JP: { name: 'Jepang', ports: ['Tokyo', 'Yokohama', 'Kobe', 'Osaka', 'Nagoya'], cities: ['Tokyo', 'Yokohama', 'Osaka', 'Kobe', 'Nagoya', 'Fukuoka', 'Shizuoka'] },
  NL: { name: 'Belanda', ports: ['Rotterdam', 'Amsterdam'], cities: ['Rotterdam', 'Amsterdam', 'Utrecht', 'Zaandam', 'Eindhoven', 'Den Haag'] },
  AE: { name: 'Uni Emirat Arab', ports: ['Jebel Ali', 'Port Khalifa', 'Sharjah'], cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'] },
  AU: { name: 'Australia', ports: ['Sydney', 'Melbourne', 'Brisbane', 'Fremantle', 'Adelaide'], cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'] },
};
const ORIGINS = [
  ['ID', 'Indonesia', ['Tanjung Priok, Jakarta', 'Tanjung Perak, Surabaya', 'Tanjung Emas, Semarang', 'Belawan, Medan', 'Makassar']],
  ['VN', 'Vietnam', ['Ho Chi Minh City', 'Hai Phong', 'Da Nang']],
  ['BR', 'Brasil', ['Santos', 'Paranagua']],
  ['CO', 'Kolombia', ['Cartagena', 'Buenaventura']],
  ['IN', 'India', ['Chennai', 'Nhava Sheva', 'Kochi']],
  ['TH', 'Thailand', ['Laem Chabang', 'Bangkok']],
  ['CN', 'Tiongkok', ['Qingdao', 'Ningbo', 'Shanghai']],
  ['MY', 'Malaysia', ['Port Klang', 'Penang']],
  ['EC', 'Ekuador', ['Guayaquil']],
  ['ET', 'Ethiopia', ['Djibouti (transit)']],
];

// ---------- company-name material ----------
const NAME_PARTS = {
  US: { pre: ['Pacific', 'Blue Harbor', 'Golden State', 'Cascade', 'Atlas', 'Summit', 'Lakeshore', 'Redwood', 'Liberty', 'Meridian', 'Crescent', 'Frontier', 'Harborview', 'Stonebridge', 'Northstar', 'Ridgeline', 'Bayline', 'Silverleaf', 'Oakfield', 'Clearwater'], suf: ['Inc.', 'LLC', 'Corp.', 'Co.'] },
  JP: { pre: ['Marusen Shoji', 'Sakura', 'Nishimura', 'Takahashi', 'Fujiwara', 'Kobayashi', 'Yamato', 'Hokkai', 'Kansai', 'Tokai', 'Nippon Grand', 'Asahi Trade', 'Kizuna', 'Sunrise Toyo', 'Midori'], suf: ['Co., Ltd.', 'K.K.', 'Shokai Ltd.', 'Corporation'] },
  NL: { pre: ['Van der Berg', 'Hollandia', 'De Groot', 'Amstel', 'Rijnland', 'Zeewind', 'Oranje', 'Maas', 'Noordzee', 'Tulipa', 'Vermeer', 'Bakker & Zonen', 'Erasmus', 'Delta West'], suf: ['B.V.', 'Trading B.V.', 'Group B.V.', 'Import B.V.'] },
  AE: { pre: ['Al Manara', 'Gulf Star', 'Emirates Crown', 'Al Fardan', 'Desert Rose', 'Arabian Pearl', 'Al Noor', 'Falcon Gate', 'Oasis Prime', 'Al Bahr', 'Golden Dune', 'Hamriyah'], suf: ['Trading LLC', 'General Trading FZE', 'Foodstuff Trading LLC', 'International FZCO'] },
  AU: { pre: ['Southern Cross', 'Koala Bay', 'Great Reef', 'Outback', 'Harbour City', 'Eucalypt', 'Kangaroo Point', 'Coral Coast', 'Blue Mountains', 'Tasman', 'Goldfields', 'Wattle Grove'], suf: ['Pty Ltd', 'Imports Pty Ltd', 'Trading Pty Ltd', 'Group Pty Ltd'] },
};
const MID = {
  Coffee: ['Coffee', 'Coffee Roasters', 'Coffee Importers', 'Bean', 'Roastery', 'Specialty Coffee'],
  Seafood: ['Seafood', 'Marine Foods', 'Fisheries', 'Ocean Products', 'Frozen Foods'],
  Spices: ['Spice', 'Spices & Herbs', 'Ingredients', 'Flavors'],
  'Agri-food': ['Commodities', 'Agri Products', 'Food Ingredients', 'Oils & Fats'],
  Rubber: ['Rubber', 'Polymer', 'Industrial Materials'],
  'Wood products': ['Timber', 'Panel Products', 'Building Materials', 'Wood'],
  'Home & living': ['Home Living', 'Decor', 'Lifestyle Goods', 'Homeware'],
  Furniture: ['Furniture', 'Furnishings', 'Interiors', 'Living Concepts', 'Home Collections'],
};
const EXPORTER_NAMES = {
  ID: ['PT Sinar Jaya Ekspor', 'PT Nusantara Agro Lestari', 'CV Java Prima Abadi', 'PT Sumatra Highland Coffee', 'PT Bahari Makmur Sejati', 'PT Rotan Cirebon Kreasi', 'PT Jepara Furni Craft', 'CV Toraja Coffee Estate', 'PT Karet Alam Sentosa', 'PT Kayu Lapis Kalimantan', 'PT Gayo Mountain Export', 'CV Bali Artisan Works', 'PT Udang Windu Perkasa', 'PT Rempah Maluku Jaya', 'PT Kelapa Hijau Industri', 'CV Solo Furniture Legacy', 'PT Mina Bahari Nusantara', 'PT Anugerah Lada Bangka', 'PT Tuna Bitung Samudra', 'CV Semarang Wood Works'],
  VN: ['Saigon Trading JSC', 'Mekong Seafood Corp', 'Highland Coffee Vietnam Ltd', 'Binh Duong Furniture Co', 'Vinacafe Export JSC', 'Hai Phong Marine Products'],
  BR: ['Santos Cafe Exportadora', 'Cerrado Coffee Trading', 'Brasil Graos SA'],
  CO: ['Cafetera Andina SAS', 'Colombia Premium Coffee SA'],
  IN: ['Kerala Spice Exports Pvt', 'Chennai Marine Foods Ltd', 'Malabar Pepper Co'],
  TH: ['Siam Seafood Intl', 'Thai Rubber Latex Corp', 'Bangkok Agro Export'],
  CN: ['Qingdao Ocean Harvest', 'Ningbo Home Furnishing Co', 'Shandong Foods Group'],
  MY: ['Penang Commodity Trading', 'Selangor Furniture Industries'],
  EC: ['Guayaquil Shrimp Export SA', 'EcuaMarine Corp'],
  ET: ['Sidamo Coffee Exporters', 'Yirgacheffe Union'],
};

// ---------- password hashing (same as auth.js) ----------
function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// ---------- date helpers ----------
const NOW = new Date('2026-07-07T00:00:00Z');
function daysAgo(n) { const d = new Date(NOW); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }

// ---------- scoring (per Functional Spec F4) ----------
function computeScores(b) {
  const last = b.last_shipment_date ? Math.round((NOW - new Date(b.last_shipment_date)) / 86400000) : 9999;
  const recencyBonus = last < 30 ? 20 : last <= 90 ? 10 : 0;
  const activity = Math.min(100, b.shipments_12mo * 5 + recencyBonus);
  const growth = b.yoy_percent === null ? null : Math.round(50 + Math.max(-50, Math.min(50, b.yoy_percent)));
  let reach = 0;
  if (b._has.email) reach += 30;
  if (b._has.phone) reach += 20;
  if (b._has.linkedin) reach += 25;
  if (b._has.website) reach += 15;
  if (b._has.person) reach += 10;
  const untapped = b.has_indonesian_supplier ? (b._idShare > 0.4 ? 0 : 40) : 100;
  // base aggregate excludes user-specific Product Fit (25%); renormalize over 75%
  const g = growth === null ? 50 : growth;
  const base = Math.round((activity * 0.30 + g * 0.20 + reach * 0.15 + untapped * 0.10) / 0.75);
  return { activity, growth, reach, untapped, base: Math.min(100, base) };
}

// ---------- main ----------
function seed(db) {
  const tx = (fn) => { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };

  tx(() => {
    // HS codes
    const insHs = db.prepare('INSERT INTO hs_codes (code,parent_code,level,description_en,description_id,chapter) VALUES (?,?,?,?,?,?)');
    for (const [code, parent, level, en, id] of HS) insHs.run(code, parent, level, en, id, code.slice(0, 2));

    // Exporters
    const insExp = db.prepare('INSERT INTO exporters (name,country,is_indonesian) VALUES (?,?,?)');
    const exporters = [];
    for (const [cc, , ] of ORIGINS) {
      for (const name of EXPORTER_NAMES[cc] || []) {
        insExp.run(name, cc, cc === 'ID' ? 1 : 0);
        exporters.push({ id: exporters.length + 1, name, country: cc, is_indonesian: cc === 'ID' });
      }
    }

    // Buyers + shipments
    const insBuyer = db.prepare(`INSERT INTO buyers (name,country,city,address,industry,size_bucket,website,description,data_confidence,
      first_shipment_date,last_shipment_date,total_shipments,total_volume_kg,total_value_usd,shipments_12mo,volume_12mo_kg,value_12mo_usd,
      yoy_percent,has_indonesian_supplier,activity_score,growth_score,reachability_score,untapped_score,base_score)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insBH = db.prepare('INSERT INTO buyer_hs (buyer_id,hs_code,shipment_count,total_volume_kg,total_value_usd,first_seen,last_seen) VALUES (?,?,?,?,?,?,?)');
    const insContact = db.prepare('INSERT INTO buyer_contacts (buyer_id,contact_type,value,person_name,person_title,confidence) VALUES (?,?,?,?,?,?)');
    const insShip = db.prepare(`INSERT INTO shipments (shipment_date,hs_code,buyer_id,exporter_id,origin_port,dest_port,weight_kg,quantity,quantity_unit,value_usd,container_count,goods_description,source)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    const FIRST = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Yuki', 'Kenji', 'Haruto', 'Lars', 'Sanne', 'Pieter', 'Ahmed', 'Fatima', 'Omar', 'Liam', 'Olivia', 'Jack', 'Mei', 'Tom', 'Anna'];
    const LAST = ['Miller', 'Chen', 'Johnson', 'Tanaka', 'Sato', 'Watanabe', 'De Vries', 'Jansen', 'Van Dijk', 'Al Rashid', 'Hassan', 'Khan', 'Wilson', 'Taylor', 'Brown', 'Nguyen', 'Kim', 'Smith'];
    const TITLES = ['Purchasing Manager', 'Head of Sourcing', 'Import Director', 'Procurement Lead', 'Managing Director', 'Supply Chain Manager', 'Category Buyer'];

    const countryKeys = Object.keys(COUNTRIES);
    const countryWeights = { US: 0.38, JP: 0.17, NL: 0.16, AE: 0.14, AU: 0.15 };
    const usedNames = new Set();
    const N_BUYERS = 210;

    for (let i = 0; i < N_BUYERS; i++) {
      // country by weight
      let r = rnd(), country = 'US';
      for (const c of countryKeys) { r -= countryWeights[c]; if (r <= 0) { country = c; break; } }

      // pick 1–3 leaf HS codes, same industry cluster preferred
      const mainHs = pick(LEAF_HS);
      const industry = HS_PROFILE[mainHs][0];
      const cluster = LEAF_HS.filter((h) => HS_PROFILE[h][0] === industry);
      const hsSet = new Set([mainHs]);
      const extra = ri(0, 2);
      for (let k = 0; k < extra; k++) hsSet.add(rnd() < 0.7 ? pick(cluster) : pick(LEAF_HS));
      const hsCodes = [...hsSet];

      // company name
      let name, guard = 0;
      do {
        const p = NAME_PARTS[country];
        name = `${pick(p.pre)} ${pick(MID[industry])} ${pick(p.suf)}`;
        guard++;
      } while (usedNames.has(name) && guard < 30);
      usedNames.add(name);
      const city = pick(COUNTRIES[country].cities);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);

      // activity profile
      const profileRoll = rnd();
      // very active | active | occasional | dormant
      const perYear = profileRoll < 0.18 ? ri(14, 40) : profileRoll < 0.55 ? ri(4, 12) : profileRoll < 0.85 ? ri(1, 3) : 0;
      const startMonthsAgo = ri(6, 24);
      const isNew = rnd() < 0.08; // recently appeared buyer (for alerts)

      // supplier mix: preferred exporter countries per industry
      const prefOrigins = {
        Coffee: ['BR', 'CO', 'VN', 'ET', 'ID'], Seafood: ['VN', 'IN', 'EC', 'TH', 'CN', 'ID'],
        Spices: ['VN', 'IN', 'ID'], 'Agri-food': ['MY', 'TH', 'ID'], Rubber: ['TH', 'VN', 'ID'],
        'Wood products': ['CN', 'MY', 'VN', 'ID'], 'Home & living': ['VN', 'CN', 'ID'], Furniture: ['VN', 'CN', 'MY', 'ID'],
      }[industry];
      const buysFromIndonesia = rnd() < 0.42;

      // generate shipments over up to 24 months
      const ships = [];
      const monthsSpan = isNew ? ri(0, 1) : startMonthsAgo;
      const totalShip = isNew ? ri(1, 3) : Math.max(0, Math.round(perYear * (monthsSpan / 12) * rf(0.8, 1.3)));
      for (let s = 0; s < totalShip; s++) {
        const dAgo = isNew ? ri(2, 28) : ri(2, monthsSpan * 30);
        const date = daysAgo(dAgo);
        const hs = hsCodes[Math.floor(rnd() * hsCodes.length)];
        const [, unit, priceRange, desc] = HS_PROFILE[hs];
        let originCC;
        if (buysFromIndonesia && rnd() < 0.35) originCC = 'ID';
        else originCC = pick(prefOrigins.filter((c) => c !== 'ID' || buysFromIndonesia));
        const origin = ORIGINS.find((o) => o[0] === originCC);
        const expPool = exporters.filter((e) => e.country === originCC);
        const exp = pick(expPool);
        const containers = ri(1, industry === 'Furniture' || industry === 'Wood products' ? 4 : 2);
        let weight, qty;
        if (unit === 'KG') { weight = containers * rf(16000, 24000); qty = weight; }
        else if (unit === 'M3') { qty = containers * rf(40, 55); weight = qty * 550; }
        else { qty = containers * ri(180, 950); weight = qty * rf(8, 30); }
        const priceKg = unit === 'M3' ? rf(priceRange[0], priceRange[1]) / 550 : rf(priceRange[0], priceRange[1]);
        const value = Math.round(weight * priceKg);
        ships.push({ date, hs, exp, origin: pick(origin[2]), dest: pick(COUNTRIES[country].ports), weight: Math.round(weight), qty: Math.round(qty), unit, value, containers, desc });
      }
      ships.sort((a, b) => a.date < b.date ? -1 : 1);

      // aggregates
      const cutoff12 = daysAgo(365), cutoff24 = daysAgo(730);
      const last12 = ships.filter((s) => s.date >= cutoff12);
      const prev12 = ships.filter((s) => s.date >= cutoff24 && s.date < cutoff12);
      const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
      const vol12 = sum(last12, (s) => s.weight), volPrev = sum(prev12, (s) => s.weight);
      const yoy = prev12.length === 0 ? null : Math.round(((vol12 - volPrev) / Math.max(1, volPrev)) * 100);
      const idShips = ships.filter((s) => s.exp.is_indonesian).length;

      // contacts
      const has = { email: rnd() < 0.62, phone: rnd() < 0.45, linkedin: rnd() < 0.5, website: rnd() < 0.75, person: rnd() < 0.4 };
      const totalVol = sum(ships, (s) => s.weight);
      const sizeBucket = totalVol > 800000 ? 'XL' : totalVol > 300000 ? 'L' : totalVol > 80000 ? 'M' : 'S';

      const bMeta = {
        last_shipment_date: ships.length ? ships[ships.length - 1].date : null,
        shipments_12mo: last12.length, yoy_percent: yoy,
        has_indonesian_supplier: idShips > 0 ? 1 : 0,
        _has: has, _idShare: ships.length ? idShips / ships.length : 0,
      };
      const sc = computeScores(bMeta);

      insBuyer.run(
        name, country, city, `${ri(10, 9800)} ${pick(['Trade Center', 'Harbor Blvd', 'Industrial Park', 'Main Street', 'Port Road', 'Business Bay'])}, ${city}`,
        industry, sizeBucket, has.website ? `https://www.${slug}.com` : null,
        null, ri(55, 95),
        ships.length ? ships[0].date : null, bMeta.last_shipment_date,
        ships.length, Math.round(totalVol), Math.round(sum(ships, (s) => s.value)),
        last12.length, Math.round(vol12), Math.round(sum(last12, (s) => s.value)),
        yoy, bMeta.has_indonesian_supplier,
        sc.activity, sc.growth, sc.reach, sc.untapped, sc.base
      );
      const buyerId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

      // buyer_hs aggregates
      const byHs = {};
      for (const s of ships) {
        byHs[s.hs] = byHs[s.hs] || { n: 0, w: 0, v: 0, first: s.date, last: s.date };
        const o = byHs[s.hs]; o.n++; o.w += s.weight; o.v += s.value;
        if (s.date < o.first) o.first = s.date;
        if (s.date > o.last) o.last = s.date;
      }
      for (const hs of hsCodes) if (!byHs[hs]) byHs[hs] = { n: 0, w: 0, v: 0, first: null, last: null };
      for (const [hs, o] of Object.entries(byHs)) insBH.run(buyerId, hs, o.n, Math.round(o.w), Math.round(o.v), o.first, o.last);

      // contacts
      if (has.website) insContact.run(buyerId, 'website', `https://www.${slug}.com`, null, null, 90);
      if (has.email) insContact.run(buyerId, 'email', `${rnd() < 0.5 ? 'purchasing' : 'info'}@${slug}.com`, null, null, ri(55, 90));
      if (has.phone) insContact.run(buyerId, 'phone', `+${pick(['1', '81', '31', '971', '61'])} ${ri(200, 999)} ${ri(100, 999)} ${ri(1000, 9999)}`, null, null, ri(50, 85));
      if (has.linkedin) insContact.run(buyerId, 'linkedin', `https://linkedin.com/company/${slug}`, null, null, 80);
      if (has.person) {
        const pn = `${pick(FIRST)} ${pick(LAST)}`;
        insContact.run(buyerId, 'email', `${pn.toLowerCase().replace(/ /g, '.')}@${slug}.com`, pn, pick(TITLES), ri(60, 92));
      }

      // shipments
      for (const s of ships) {
        insShip.run(s.date, s.hs, buyerId, s.exp.id, s.origin, s.dest, s.weight, s.qty, s.unit, s.value, s.containers,
          s.desc, pick(['US CBP AMS', 'Import Genius mirror', 'Customs declarations', 'Port manifest']));
      }
    }

    // ---------- system outreach templates ----------
    const insTpl = db.prepare('INSERT INTO templates (user_id,category,language,channel,name,subject,body) VALUES (NULL,?,?,?,?,?,?)');
    const T = [
      ['first_touch', 'en', 'email', 'First touch — introduction (EN)',
        'Partnership inquiry: {{hs_description}} supply from Indonesia',
        `Dear {{buyer_name}} team,\n\nMy name is {{user_name}} from {{org_name}}, an Indonesian exporter of {{hs_description}} (HS {{hs_code}}).\n\nWe noticed {{buyer_name}} actively imports this product{{last_shipment_note}}. Indonesia offers competitive advantages: consistent harvest quality, direct-trade pricing, and established export logistics to {{buyer_country}}.\n\nWe would love to send you our product catalog and a free sample. Would you be open to a short call next week?\n\nBest regards,\n{{user_name}}\n{{org_name}} — Indonesia`],
      ['followup_1', 'en', 'email', 'Follow-up #1 (EN)',
        'Re: {{hs_description}} supply from Indonesia',
        `Hello {{buyer_name}} team,\n\nFollowing up on my previous note — I understand you are busy. To make it easy, here is a one-line summary:\n\n{{org_name}} (Indonesia) supplies {{hs_description}} with export-grade certification, and we'd like to offer you a free sample shipment.\n\nIf this is relevant, just reply "interested" and I will handle the rest.\n\nBest,\n{{user_name}}`],
      ['followup_2', 'en', 'email', 'Follow-up #2 — break-up (EN)',
        'Should I close your file?',
        `Hi {{buyer_name}} team,\n\nI haven't heard back, so I assume the timing isn't right for new {{hs_description}} suppliers. I'll close your file for now.\n\nIf demand picks up — especially before peak season — feel free to reach out. We keep dedicated allocation for {{buyer_country}} buyers.\n\nRegards,\n{{user_name}}, {{org_name}}`],
      ['meeting_request', 'en', 'email', 'Meeting request (EN)',
        '15-minute call re: {{hs_description}} supply',
        `Dear {{buyer_name}} team,\n\nWould you have 15 minutes this week for a short video call? I'd like to show you our {{hs_description}} (HS {{hs_code}}) specifications, pricing FOB Indonesian ports, and lead times to {{buyer_country}}.\n\nYou can pick any time here, or simply reply with a slot that suits you.\n\nThank you,\n{{user_name}} — {{org_name}}`],
      ['first_touch', 'en', 'whatsapp', 'First touch — WhatsApp (EN)', null,
        `Hello {{buyer_name}}! This is {{user_name}} from {{org_name}}, Indonesia 🇮🇩. We export {{hs_description}} (HS {{hs_code}}) and currently supply buyers in {{buyer_country}}. May I send you our catalog and FOB price list? Thank you!`],
      ['first_touch', 'es', 'email', 'Primer contacto (ES)',
        'Suministro de {{hs_description}} desde Indonesia',
        `Estimado equipo de {{buyer_name}}:\n\nSoy {{user_name}} de {{org_name}}, exportador indonesio de {{hs_description}} (HS {{hs_code}}).\n\nSabemos que {{buyer_name}} importa este producto regularmente. Nos gustaría enviarles nuestro catálogo y una muestra gratuita.\n\n¿Tendría disponibilidad para una breve llamada la próxima semana?\n\nSaludos cordiales,\n{{user_name}} — {{org_name}}, Indonesia`],
      ['first_touch', 'ar', 'email', 'الاتصال الأول (AR)',
        'استفسار شراكة: توريد {{hs_description}} من إندونيسيا',
        `السادة فريق {{buyer_name}} المحترمين،\n\nأنا {{user_name}} من شركة {{org_name}}، مُصدِّر إندونيسي لمنتج {{hs_description}} (HS {{hs_code}}).\n\nنعلم أن شركتكم تستورد هذا المنتج بانتظام، ويسعدنا إرسال الكتالوج وعينة مجانية.\n\nهل يمكننا ترتيب مكالمة قصيرة الأسبوع القادم؟\n\nمع خالص التحية،\n{{user_name}} — {{org_name}}`],
      ['first_touch', 'zh', 'email', '首次联系 (ZH)',
        '来自印度尼西亚的{{hs_description}}供应合作咨询',
        `尊敬的{{buyer_name}}团队：\n\n我是{{org_name}}的{{user_name}}，我们是印度尼西亚的{{hs_description}}（HS {{hs_code}}）出口商。\n\n我们了解到贵司定期进口该产品。我们希望向您发送产品目录和免费样品。\n\n下周是否方便安排一次简短的通话？\n\n此致敬礼\n{{user_name}} — {{org_name}}（印度尼西亚）`],
      ['first_touch', 'ja', 'email', '初回コンタクト (JA)',
        'インドネシア産{{hs_description}}のご提案',
        `{{buyer_name}} ご担当者様\n\nインドネシアの輸出企業 {{org_name}} の {{user_name}} と申します。弊社は {{hs_description}}（HS {{hs_code}}）を輸出しております。\n\n貴社が本製品を定期的に輸入されていると伺い、カタログと無料サンプルをお送りしたくご連絡いたしました。\n\n来週、15分ほどオンラインでお話しできれば幸いです。\n\n何卒よろしくお願い申し上げます。\n{{user_name}} — {{org_name}}`],
      ['sample_response', 'en', 'email', 'Sample request response (EN)',
        'Your sample of {{hs_description}} — shipping details',
        `Dear {{buyer_name}} team,\n\nThank you for your interest in our {{hs_description}}. We will dispatch the sample within 3 working days via DHL Express, at no cost to you.\n\nCould you confirm the delivery address and the specification you want us to match (grade, moisture, packaging)?\n\nBest regards,\n{{user_name}} — {{org_name}}`],
    ];
    for (const t of T) insTpl.run(...t);

    // ---------- demo user (Growth tier, coffee exporter) ----------
    const insUser = db.prepare(`INSERT INTO users (email,password_hash,name,org_name,plan,hs_focus,target_countries,export_status,goal,onboarded)
      VALUES (?,?,?,?,?,?,?,?,?,1)`);
    insUser.run('demo@eksporin.id', hashPassword('demo1234'), 'Andi Prasetyo', 'PT Kopi Nusantara Ekspor', 'growth',
      JSON.stringify(['090111', '090121', '090411']), JSON.stringify(['US', 'JP', 'NL']), 'occasional', 'find_buyers');
    const demoId = db.prepare('SELECT id FROM users WHERE email=?').get('demo@eksporin.id').id;

    // demo saved list with pipeline states
    db.prepare('INSERT INTO lists (user_id,name,description,color) VALUES (?,?,?,?)')
      .run(demoId, 'Prospek Kopi Q3 2026', 'Buyer kopi prioritas untuk outreach kuartal ini', '#2563EB');
    const listId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    const coffeeBuyers = db.prepare(`SELECT DISTINCT b.id FROM buyers b JOIN buyer_hs bh ON bh.buyer_id=b.id
      WHERE bh.hs_code IN ('090111','090121') AND b.country IN ('US','JP','NL') ORDER BY b.base_score DESC LIMIT 12`).all();
    const statuses = ['new', 'new', 'new', 'contacted', 'contacted', 'contacted', 'responded', 'responded', 'negotiating', 'negotiating', 'won', 'lost'];
    const insLB = db.prepare('INSERT INTO list_buyers (list_id,buyer_id,status,priority,tags,added_at) VALUES (?,?,?,?,?,?)');
    coffeeBuyers.forEach((row, idx) => {
      insLB.run(listId, row.id, statuses[idx % statuses.length], pick(['high', 'medium', 'low']),
        JSON.stringify(idx % 3 === 0 ? ['arabica', 'specialty'] : ['robusta']), daysAgo(ri(1, 40)) + ' 08:00:00');
    });
    // a couple of demo notes + sent messages
    if (coffeeBuyers.length) {
      db.prepare('INSERT INTO notes (user_id,buyer_id,body,created_at) VALUES (?,?,?,?)')
        .run(demoId, coffeeBuyers[3].id, 'Sudah kirim intro email. Minta sample 5kg Gayo grade 1. Follow-up minggu depan.', daysAgo(6) + ' 09:12:00');
      db.prepare('INSERT INTO notes (user_id,buyer_id,body,created_at) VALUES (?,?,?,?)')
        .run(demoId, coffeeBuyers[8].id, 'Nego harga FOB. Mereka minta $5.20/kg, kita tawar $5.60. Target closing akhir bulan.', daysAgo(2) + ' 14:30:00');
      const tpl = db.prepare("SELECT * FROM templates WHERE category='first_touch' AND language='en' AND channel='email'").get();
      const insMsg = db.prepare(`INSERT INTO messages (user_id,buyer_id,template_id,channel,subject,body,status,sent_at,opened_at,replied_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`);
      const msgStates = [['opened', daysAgo(5), daysAgo(4), null], ['replied', daysAgo(9), daysAgo(8), daysAgo(7)], ['sent', daysAgo(1), null, null], ['opened', daysAgo(3), daysAgo(3), null]];
      msgStates.forEach((st, i) => {
        const b = coffeeBuyers[i + 3]; if (!b) return;
        insMsg.run(demoId, b.id, tpl.id, 'email', 'Partnership inquiry: green coffee supply from Indonesia',
          '(pesan terkirim via template First touch EN)', st[0], st[1] + ' 10:00:00', st[2] ? st[2] + ' 15:21:00' : null, st[3] ? st[3] + ' 11:05:00' : null);
      });
      // usage meters so the quota bar looks alive
      const period = NOW.toISOString().slice(0, 7);
      const insUse = db.prepare('INSERT INTO usage_meters (user_id,meter,period,used) VALUES (?,?,?,?)');
      insUse.run(demoId, 'search', period, 37);
      insUse.run(demoId, 'profile', period, 22);
      insUse.run(demoId, 'send', period, 4);
    }
  });
}

module.exports = { seed, hashPassword };
