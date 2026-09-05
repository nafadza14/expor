// EksporIn | minimal seeder
// After migrating buyer data to Postgres (scraped_buyers), sql.js is
// used only for user accounts, sessions, HS taxonomy dropdowns, and
// system-owned outreach templates. Everything else (buyers, shipments,
// lists, notes, messages) is now populated by the crawlers or by the
// user's own activity, never by a demo dump.

'use strict';
const { scryptSync, randomBytes } = require('node:crypto');

// ---------- HS taxonomy (chapters relevant to Indonesian exports) ----------
// Loaded into hs_codes so the onboarding wizard, settings page, and the
// HS picker always have a fallback list even before the WCO CSV loads.
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
  ['0905', '09', 4, 'Vanilla beans', 'Vanili'],
  ['090510', '0905', 6, 'Vanilla, neither crushed nor ground', 'Vanili utuh (polong kering)'],
  ['090520', '0905', 6, 'Vanilla, crushed or ground', 'Vanili bubuk'],
  ['0906', '09', 4, 'Cinnamon', 'Kayu manis'],
  ['090610', '0906', 6, 'Cinnamon, neither crushed nor ground', 'Kayu manis utuh'],
  ['0907', '09', 4, 'Cloves', 'Cengkeh'],
  ['090710', '0907', 6, 'Cloves, neither crushed nor ground', 'Cengkeh utuh'],
  ['0908', '09', 4, 'Nutmeg, mace and cardamoms', 'Pala, fuli, dan kapulaga'],
  ['090811', '0908', 6, 'Nutmeg, neither crushed nor ground', 'Pala utuh'],
  ['0910', '09', 4, 'Ginger, turmeric, saffron', 'Jahe, kunyit, saffron'],
  ['091011', '0910', 6, 'Ginger, neither crushed nor ground', 'Jahe utuh'],
  ['091030', '0910', 6, 'Turmeric', 'Kunyit'],
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
  ['4407', '44', 4, 'Wood sawn or chipped lengthwise', 'Kayu gergajian'],
  ['440729', '4407', 6, 'Other tropical wood sawn', 'Kayu gergajian tropis lainnya'],
  ['94', null, 2, 'Furniture; bedding, lamps', 'Furnitur; kasur, lampu'],
  ['9403', '94', 4, 'Other furniture and parts', 'Furnitur lainnya dan komponennya'],
  ['940360', '9403', 6, 'Wooden furniture (other)', 'Furnitur kayu lainnya'],
];

// ---------- password hashing (matches auth.js) ----------
function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

function seed(db) {
  const tx = (fn) => {
    db.exec('BEGIN');
    try { fn(); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  tx(() => {
    // HS codes
    const insHs = db.prepare('INSERT INTO hs_codes (code,parent_code,level,description_en,description_id,chapter) VALUES (?,?,?,?,?,?)');
    for (const [code, parent, level, en, id] of HS) insHs.run(code, parent, level, en, id, code.slice(0, 2));

    // System outreach templates
    const insTpl = db.prepare('INSERT INTO templates (user_id,category,language,channel,name,subject,body) VALUES (NULL,?,?,?,?,?,?)');
    const T = [
      ['first_touch', 'en', 'email', 'First touch: introduction (EN)',
        'Partnership inquiry: {{hs_description}} supply from Indonesia',
        `Dear {{buyer_name}} team,\n\nMy name is {{user_name}} from {{org_name}}, an Indonesian exporter of {{hs_description}} (HS {{hs_code}}).\n\nWe noticed {{buyer_name}} actively imports this product{{last_shipment_note}}. Indonesia offers competitive advantages: consistent harvest quality, direct-trade pricing, and established export logistics to {{buyer_country}}.\n\nWe would love to send you our product catalog and a free sample. Would you be open to a short call next week?\n\nBest regards,\n{{user_name}}\n{{org_name}}, Indonesia`],
      ['followup_1', 'en', 'email', 'Follow-up #1 (EN)',
        'Re: {{hs_description}} supply from Indonesia',
        `Hello {{buyer_name}} team,\n\nFollowing up on my previous note. I understand you are busy. To make it easy, here is a one-line summary:\n\n{{org_name}} (Indonesia) supplies {{hs_description}} with export-grade certification, and we would like to offer you a free sample shipment.\n\nIf this is relevant, just reply "interested" and I will handle the rest.\n\nBest,\n{{user_name}}`],
      ['followup_2', 'en', 'email', 'Follow-up #2: break-up (EN)',
        'Should I close your file?',
        `Hi {{buyer_name}} team,\n\nI have not heard back, so I assume the timing is not right for new {{hs_description}} suppliers. I will close your file for now.\n\nIf demand picks up, especially before peak season, feel free to reach out. We keep dedicated allocation for {{buyer_country}} buyers.\n\nRegards,\n{{user_name}}, {{org_name}}`],
      ['meeting_request', 'en', 'email', 'Meeting request (EN)',
        '15-minute call re: {{hs_description}} supply',
        `Dear {{buyer_name}} team,\n\nWould you have 15 minutes this week for a short video call? I would like to show you our {{hs_description}} (HS {{hs_code}}) specifications, pricing FOB Indonesian ports, and lead times to {{buyer_country}}.\n\nYou can pick any time here, or simply reply with a slot that suits you.\n\nThank you,\n{{user_name}}, {{org_name}}`],
      ['first_touch', 'en', 'whatsapp', 'First touch: WhatsApp (EN)', null,
        `Hello {{buyer_name}}! This is {{user_name}} from {{org_name}}, Indonesia. We export {{hs_description}} (HS {{hs_code}}) and currently supply buyers in {{buyer_country}}. May I send you our catalog and FOB price list? Thank you!`],
      ['sample_response', 'en', 'email', 'Sample request response (EN)',
        'Your sample of {{hs_description}}: shipping details',
        `Dear {{buyer_name}} team,\n\nThank you for your interest in our {{hs_description}}. We will dispatch the sample within 3 working days via DHL Express, at no cost to you.\n\nCould you confirm the delivery address and the specification you want us to match (grade, moisture, packaging)?\n\nBest regards,\n{{user_name}}, {{org_name}}`],
    ];
    for (const t of T) insTpl.run(...t);

    // Demo user (optional; free for smoke-testing the UX with a fresh account)
    db.prepare(`INSERT INTO users (email,password_hash,name,org_name,plan,hs_focus,target_countries,onboarded)
      VALUES (?,?,?,?,?,?,?,1)`)
      .run('demo@eksporin.id', hashPassword('demo1234'), 'Andi Prasetyo', 'PT Kopi Nusantara Ekspor', 'growth',
        JSON.stringify(['090111', '090121']), JSON.stringify(['US', 'DE', 'NL']));

    // Business test account (Winston's testing profile).
    db.prepare(`INSERT INTO users (email,password_hash,name,org_name,plan,hs_focus,target_countries,onboarded)
      VALUES (?,?,?,?,?,?,?,1)`)
      .run('admin@super-vanilla.com', hashPassword('supersekali'), 'Super Vanilla Admin', 'PT Super Vanilla',
        'business', JSON.stringify(['090510', '090520']), JSON.stringify(['US', 'DE', 'FR', 'JP']));

    // Super admin
    db.prepare(`INSERT INTO users (email,password_hash,name,org_name,plan,is_admin,onboarded)
      VALUES (?,?,?,?,?,?,1)`)
      .run('test@zieads.com', hashPassword('asikasikjos14'), 'Super Admin', 'EksporIn Admin', 'business', 1);
  });
}

module.exports = { seed, hashPassword };
