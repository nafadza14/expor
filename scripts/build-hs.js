#!/usr/bin/env node
// Builds data/hs-id.json: the full Harmonized System in Indonesian and
// English, from the Buku Tarif Kepabeanan Indonesia (BTKI) 2022 (PMK
// 26/PMK.010/2022), which lists every heading, 6-digit subheading and
// 8-digit national tariff line with both an Indonesian and an English text.
//
//   node scripts/build-hs.js path/to/btki2022.json
//
// Input: a JSON array of {hs, desc_id, desc_en} rows in BTKI order. Rows
// without a code are group headings ("- Kopi, tidak digongseng :") that
// give context to the indented lines below them; they are folded into the
// "path" of each code so a search for "kopi tidak digongseng" finds them.
//
// Output nodes: {c: code, l: level 2|4|6|8, p: parent, i: Indonesian text,
// e: English text, pi/pe: context path (without the heading), h: heading}

'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CHAPTERS = {
  '01': ['Binatang hidup', 'Live animals'],
  '02': ['Daging dan sisa daging yang dapat dimakan', 'Meat and edible meat offal'],
  '03': ['Ikan, krustasea, moluska dan invertebrata air lainnya', 'Fish and crustaceans, molluscs and other aquatic invertebrates'],
  '04': ['Susu dan produk susu; telur unggas; madu alam; produk hewani lainnya', 'Dairy produce; birds\' eggs; natural honey; edible products of animal origin'],
  '05': ['Produk hewani lainnya', 'Products of animal origin, not elsewhere specified'],
  '06': ['Pohon dan tanaman hidup; umbi, akar; bunga potong dan dedaunan hias', 'Live trees and other plants; bulbs, roots; cut flowers and ornamental foliage'],
  '07': ['Sayuran, akar dan umbi tertentu yang dapat dimakan', 'Edible vegetables and certain roots and tubers'],
  '08': ['Buah dan kacang yang dapat dimakan; kulit buah jeruk atau melon', 'Edible fruit and nuts; peel of citrus fruit or melons'],
  '09': ['Kopi, teh, mate dan rempah-rempah', 'Coffee, tea, maté and spices'],
  '10': ['Serealia', 'Cereals'],
  '11': ['Produk industri penggilingan; malt; pati; inulin; gluten gandum', 'Products of the milling industry; malt; starches; inulin; wheat gluten'],
  '12': ['Biji dan buah mengandung minyak; biji-bijian; tanaman industri atau obat; jerami', 'Oil seeds and oleaginous fruits; grains, seeds; industrial or medicinal plants; straw'],
  '13': ['Lak; getah, resin dan getah serta ekstrak nabati lainnya', 'Lac; gums, resins and other vegetable saps and extracts'],
  '14': ['Bahan anyaman nabati; produk nabati lainnya', 'Vegetable plaiting materials; vegetable products not elsewhere specified'],
  '15': ['Lemak dan minyak hewani, nabati atau mikroba; lemak olahan', 'Animal, vegetable or microbial fats and oils; prepared edible fats'],
  '16': ['Olahan dari daging, ikan, krustasea, moluska atau serangga', 'Preparations of meat, fish, crustaceans, molluscs or insects'],
  '17': ['Gula dan kembang gula', 'Sugars and sugar confectionery'],
  '18': ['Kakao dan olahannya', 'Cocoa and cocoa preparations'],
  '19': ['Olahan dari serealia, tepung, pati atau susu; produk kue', 'Preparations of cereals, flour, starch or milk; pastrycooks\' products'],
  '20': ['Olahan dari sayuran, buah, kacang atau bagian tanaman lainnya', 'Preparations of vegetables, fruit, nuts or other parts of plants'],
  '21': ['Berbagai olahan makanan', 'Miscellaneous edible preparations'],
  '22': ['Minuman, alkohol dan cuka', 'Beverages, spirits and vinegar'],
  '23': ['Residu dan sisa industri makanan; pakan ternak olahan', 'Residues and waste from the food industries; prepared animal fodder'],
  '24': ['Tembakau dan pengganti tembakau olahan; produk nikotin', 'Tobacco and manufactured tobacco substitutes; nicotine products'],
  '25': ['Garam; belerang; tanah dan batu; bahan plester, kapur dan semen', 'Salt; sulphur; earths and stone; plastering materials, lime and cement'],
  '26': ['Bijih, terak dan abu', 'Ores, slag and ash'],
  '27': ['Bahan bakar mineral, minyak mineral dan produk penyulingannya; bahan bitumen', 'Mineral fuels, mineral oils and products of their distillation; bituminous substances'],
  '28': ['Bahan kimia anorganik; senyawa logam mulia, logam tanah jarang', 'Inorganic chemicals; compounds of precious metals and rare-earth metals'],
  '29': ['Bahan kimia organik', 'Organic chemicals'],
  '30': ['Produk farmasi', 'Pharmaceutical products'],
  '31': ['Pupuk', 'Fertilisers'],
  '32': ['Ekstrak penyamak atau pewarna; tanin; pigmen; cat dan pernis; tinta', 'Tanning or dyeing extracts; tannins; pigments; paints and varnishes; inks'],
  '33': ['Minyak atsiri dan resinoid; wewangian, kosmetik dan perlengkapan mandi', 'Essential oils and resinoids; perfumery, cosmetic or toilet preparations'],
  '34': ['Sabun, bahan aktif permukaan, deterjen, pelumas, lilin', 'Soap, surface-active agents, washing and lubricating preparations, waxes'],
  '35': ['Bahan albuminoid; pati termodifikasi; lem; enzim', 'Albuminoidal substances; modified starches; glues; enzymes'],
  '36': ['Bahan peledak; kembang api; korek api', 'Explosives; pyrotechnic products; matches'],
  '37': ['Barang fotografi atau sinematografi', 'Photographic or cinematographic goods'],
  '38': ['Berbagai produk kimia', 'Miscellaneous chemical products'],
  '39': ['Plastik dan barang daripadanya', 'Plastics and articles thereof'],
  '40': ['Karet dan barang daripadanya', 'Rubber and articles thereof'],
  '41': ['Kulit mentah (selain kulit berbulu) dan kulit samak', 'Raw hides and skins (other than furskins) and leather'],
  '42': ['Barang dari kulit; pelana; barang untuk bepergian, tas tangan', 'Articles of leather; saddlery; travel goods, handbags and similar containers'],
  '43': ['Kulit berbulu dan bulu tiruan; barang daripadanya', 'Furskins and artificial fur; manufactures thereof'],
  '44': ['Kayu dan barang dari kayu; arang kayu', 'Wood and articles of wood; wood charcoal'],
  '45': ['Gabus dan barang dari gabus', 'Cork and articles of cork'],
  '46': ['Barang dari jerami, rumput atau bahan anyaman lainnya; barang anyaman', 'Manufactures of straw or other plaiting materials; basketware and wickerwork'],
  '47': ['Pulp dari kayu atau bahan selulosa lainnya; kertas bekas', 'Pulp of wood or other fibrous cellulosic material; recovered paper'],
  '48': ['Kertas dan kertas karton; barang dari pulp kertas atau kertas', 'Paper and paperboard; articles of paper pulp, paper or paperboard'],
  '49': ['Buku, surat kabar, gambar dan produk industri percetakan lainnya', 'Printed books, newspapers, pictures and other printed products'],
  '50': ['Sutra', 'Silk'],
  '51': ['Wol, bulu hewan halus atau kasar; benang dan kain tenun dari bulu kuda', 'Wool, fine or coarse animal hair; horsehair yarn and woven fabric'],
  '52': ['Kapas', 'Cotton'],
  '53': ['Serat tekstil nabati lainnya; benang kertas dan kain tenunnya', 'Other vegetable textile fibres; paper yarn and woven fabrics of paper yarn'],
  '54': ['Filamen buatan; strip dan sejenisnya dari bahan tekstil buatan', 'Man-made filaments; strip and the like of man-made textile materials'],
  '55': ['Serat stapel buatan', 'Man-made staple fibres'],
  '56': ['Gumpalan, kain kempa dan bukan tenunan; benang khusus; tali, tambang', 'Wadding, felt and nonwovens; special yarns; twine, cordage, ropes and cables'],
  '57': ['Permadani dan penutup lantai tekstil lainnya', 'Carpets and other textile floor coverings'],
  '58': ['Kain tenun khusus; kain berumbai; renda; permadani dinding; hiasan; sulaman', 'Special woven fabrics; tufted fabrics; lace; tapestries; trimmings; embroidery'],
  '59': ['Kain tekstil diresapi, dilapisi atau dilaminasi; barang tekstil untuk industri', 'Impregnated, coated or laminated textile fabrics; textile articles for industrial use'],
  '60': ['Kain rajutan atau kaitan', 'Knitted or crocheted fabrics'],
  '61': ['Pakaian dan aksesori pakaian, rajutan atau kaitan', 'Apparel and clothing accessories, knitted or crocheted'],
  '62': ['Pakaian dan aksesori pakaian, bukan rajutan atau kaitan', 'Apparel and clothing accessories, not knitted or crocheted'],
  '63': ['Barang tekstil jadi lainnya; set; pakaian bekas; kain perca', 'Other made up textile articles; sets; worn clothing; rags'],
  '64': ['Alas kaki, pelindung kaki dan sejenisnya; bagiannya', 'Footwear, gaiters and the like; parts of such articles'],
  '65': ['Tutup kepala dan bagiannya', 'Headgear and parts thereof'],
  '66': ['Payung, payung matahari, tongkat, cemeti; bagiannya', 'Umbrellas, sun umbrellas, walking-sticks, whips; parts thereof'],
  '67': ['Bulu unggas olahan dan barangnya; bunga tiruan; barang dari rambut manusia', 'Prepared feathers and down; artificial flowers; articles of human hair'],
  '68': ['Barang dari batu, plester, semen, asbes, mika atau bahan sejenis', 'Articles of stone, plaster, cement, asbestos, mica or similar materials'],
  '69': ['Produk keramik', 'Ceramic products'],
  '70': ['Kaca dan barang dari kaca', 'Glass and glassware'],
  '71': ['Mutiara, batu mulia, logam mulia dan barang daripadanya; perhiasan imitasi; koin', 'Pearls, precious stones, precious metals and articles thereof; imitation jewellery; coin'],
  '72': ['Besi dan baja', 'Iron and steel'],
  '73': ['Barang dari besi atau baja', 'Articles of iron or steel'],
  '74': ['Tembaga dan barang daripadanya', 'Copper and articles thereof'],
  '75': ['Nikel dan barang daripadanya', 'Nickel and articles thereof'],
  '76': ['Aluminium dan barang daripadanya', 'Aluminium and articles thereof'],
  '78': ['Timbal dan barang daripadanya', 'Lead and articles thereof'],
  '79': ['Seng dan barang daripadanya', 'Zinc and articles thereof'],
  '80': ['Timah dan barang daripadanya', 'Tin and articles thereof'],
  '81': ['Logam tidak mulia lainnya; kermet; barang daripadanya', 'Other base metals; cermets; articles thereof'],
  '82': ['Perkakas, peralatan, pisau, sendok dan garpu dari logam tidak mulia', 'Tools, implements, cutlery, spoons and forks, of base metal'],
  '83': ['Berbagai barang dari logam tidak mulia', 'Miscellaneous articles of base metal'],
  '84': ['Mesin dan peralatan mekanis; reaktor nuklir, ketel; bagiannya', 'Machinery and mechanical appliances; nuclear reactors, boilers; parts thereof'],
  '85': ['Mesin dan perlengkapan elektrik; perekam dan pemutar suara dan gambar televisi; bagiannya', 'Electrical machinery and equipment; sound and television recorders and reproducers; parts'],
  '86': ['Lokomotif dan gerbong kereta api atau trem; perlengkapan rel', 'Railway or tramway locomotives, rolling-stock and track fixtures'],
  '87': ['Kendaraan selain kereta api atau trem; bagian dan aksesorinya', 'Vehicles other than railway or tramway rolling-stock; parts and accessories'],
  '88': ['Pesawat udara, pesawat ruang angkasa; bagiannya', 'Aircraft, spacecraft; parts thereof'],
  '89': ['Kapal, perahu dan bangunan terapung', 'Ships, boats and floating structures'],
  '90': ['Instrumen optik, fotografi, pengukur, pemeriksa, kedokteran atau bedah', 'Optical, photographic, measuring, checking, medical or surgical instruments'],
  '91': ['Jam dan arloji serta bagiannya', 'Clocks and watches and parts thereof'],
  '92': ['Alat musik; bagian dan aksesorinya', 'Musical instruments; parts and accessories'],
  '93': ['Senjata dan amunisi; bagian dan aksesorinya', 'Arms and ammunition; parts and accessories'],
  '94': ['Furnitur; perlengkapan tempat tidur, kasur, bantal; lampu; bangunan prafabrikasi', 'Furniture; bedding, mattresses, cushions; lamps and luminaires; prefabricated buildings'],
  '95': ['Mainan, permainan dan peralatan olahraga; bagiannya', 'Toys, games and sports requisites; parts and accessories'],
  '96': ['Berbagai barang hasil pabrik', 'Miscellaneous manufactured articles'],
  '97': ['Karya seni, barang koleksi dan barang antik', 'Works of art, collectors\' pieces and antiques'],
  '98': ['Ketentuan khusus (nasional)', 'Special classification provisions (national)'],
};

function clean(s) {
  return String(s || '').replace(/^[\s\-–]+/, '').replace(/\s*:\s*$/, '').replace(/\s+/g, ' ').trim();
}
function depth(s) {
  const m = String(s || '').match(/^((?:-\s*)+)/);
  return m ? (m[1].match(/-/g) || []).length : 0;
}

function build(rows) {
  const nodes = new Map();
  for (const [code, [i, e]] of Object.entries(CHAPTERS)) nodes.set(code, { c: code, l: 2, p: null, i, e });

  let heading = null; // {code, i, e}
  let stack = [];     // context lines [{d, i, e}] by dash depth
  const add = (n) => { if (!nodes.has(n.c)) nodes.set(n.c, n); };

  for (const r of rows) {
    const digits = String(r.hs || '').replace(/\D/g, '');
    const d = depth(r.desc_id);
    const ti = clean(r.desc_id); const te = clean(r.desc_en);
    if (!digits) {
      // Group line: keep as context for deeper lines.
      stack = stack.filter((s) => s.d < d);
      stack.push({ d, i: ti, e: te });
      continue;
    }
    const h4 = digits.slice(0, 4);
    if (digits.length === 4 || /^\d{4}0000$/.test(digits)) {
      heading = { code: h4, i: ti, e: te };
      stack = [];
      add({ c: h4, l: 4, p: h4.slice(0, 2), i: ti, e: te });
      if (digits.length === 8) {
        // Heading without subdivisions: also expose it as 6- and 8-digit lines.
        add({ c: h4 + '00', l: 6, p: h4, i: ti, e: te, h: h4 });
        add({ c: digits, l: 8, p: h4 + '00', i: ti, e: te, h: h4 });
      }
      continue;
    }
    if (!heading || heading.code !== h4) {
      heading = { code: h4, i: ti, e: te };
      add({ c: h4, l: 4, p: h4.slice(0, 2), i: ti, e: te });
      stack = [];
    }
    stack = stack.filter((s) => s.d < d);
    const pi = stack.map((s) => s.i).join(' › ');
    const pe = stack.map((s) => s.e).join(' › ');
    const s6 = digits.slice(0, 6);
    if (digits.length === 6) {
      add({ c: s6, l: 6, p: h4, i: ti, e: te, pi, pe, h: h4 });
      stack.push({ d, i: ti, e: te });
      continue;
    }
    // 8-digit national line.
    if (!nodes.has(s6)) {
      // 6-digit subheading with no row of its own. "XXXX.YY.00" means the
      // subheading is not split nationally, so the line's text is the
      // subheading's. "XXXX.00.nn" lines split a heading that has no WCO
      // subheadings, so the 6-digit code is the whole heading.
      if (digits.endsWith('00')) add({ c: s6, l: 6, p: h4, i: ti, e: te, pi, pe, h: h4 });
      else if (s6.endsWith('00')) add({ c: s6, l: 6, p: h4, i: heading.i, e: heading.e, h: h4 });
      else {
        const ctx = stack[stack.length - 1];
        add({ c: s6, l: 6, p: h4, i: ctx ? ctx.i : ti, e: ctx ? ctx.e : te, pi: stack.slice(0, -1).map((x) => x.i).join(' › '), pe: stack.slice(0, -1).map((x) => x.e).join(' › '), h: h4 });
      }
    }
    add({ c: digits, l: 8, p: s6, i: ti, e: te, pi, pe, h: h4 });
  }
  return [...nodes.values()].sort((a, b) => a.c.localeCompare(b.c));
}

if (require.main === module) {
  const src = process.argv[2];
  if (!src) { console.error('usage: node scripts/build-hs.js btki2022.json'); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(src, 'utf8'));
  const nodes = build(rows);
  // Drop empty optional fields to keep the file small.
  const slim = nodes.map((n) => Object.fromEntries(Object.entries(n).filter(([, v]) => v !== '' && v !== null && v !== undefined)));
  const out = path.join(__dirname, '..', 'data', 'hs-id.json');
  fs.writeFileSync(out, JSON.stringify({
    source: 'Buku Tarif Kepabeanan Indonesia (BTKI) 2022, PMK 26/PMK.010/2022; chapter titles: WCO HS 2022',
    built: new Date().toISOString().slice(0, 10),
    nodes: slim,
  }));
  const by = slim.reduce((a, n) => ((a[n.l] = (a[n.l] || 0) + 1), a), {});
  console.log('wrote', out, by);
}

module.exports = { build, clean, depth, CHAPTERS };
