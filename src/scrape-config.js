'use strict';
// Seed HS codes and target countries for the MVP scrape queue. Chosen from
// the highest-volume Indonesian export categories in coffee and spices, and
// their top import destinations. Tweak by editing this file; the values are
// consumed by src/sources/pipeline.js and by the /api/admin/scrape/seed
// admin endpoint.

const SEED_HS_CODES = [
  { code: '0901', label_id: 'Kopi', label_en: 'Coffee' },
  { code: '0904', label_id: 'Lada', label_en: 'Pepper' },
  { code: '0905', label_id: 'Vanili', label_en: 'Vanilla' },
  { code: '0906', label_id: 'Kayu manis', label_en: 'Cinnamon' },
  { code: '0907', label_id: 'Cengkeh', label_en: 'Cloves' },
  { code: '0908', label_id: 'Pala', label_en: 'Nutmeg, mace, cardamom' },
  { code: '0910', label_id: 'Jahe, kunyit', label_en: 'Ginger, turmeric, saffron, curry' },
];

const SEED_COUNTRIES = [
  { iso2: 'US', name: 'United States', flag: '🇺🇸' },
  { iso2: 'DE', name: 'Germany', flag: '🇩🇪' },
  { iso2: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { iso2: 'IT', name: 'Italy', flag: '🇮🇹' },
  { iso2: 'JP', name: 'Japan', flag: '🇯🇵' },
  { iso2: 'IN', name: 'India', flag: '🇮🇳' },
  { iso2: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { iso2: 'EG', name: 'Egypt', flag: '🇪🇬' },
];

module.exports = { SEED_HS_CODES, SEED_COUNTRIES };
