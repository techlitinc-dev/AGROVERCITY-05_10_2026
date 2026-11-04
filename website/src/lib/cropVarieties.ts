/**
 * Real released crop varieties (ICAR / state agri-university catalogs,
 * Maharashtra-relevant). Used only as typeahead suggestions — users can
 * always pick "Other" and type a variety that is not listed. Shared by the
 * farmer produce-lot form and the agri-vyapari demand form.
 */
export const CROP_VARIETIES: [string, string[]][] = [
  ['soybean', ['JS 335', 'JS 9560', 'JS 2034', 'JS 93-05', 'NRC 86']],
  ['wheat', ['Lokwan', 'HD 2967', 'HD 3086', 'GW 322', 'DDK 1029 (Khapli)']],
  ['cotton', ['Bt Cotton BG-II (RCH 659)', 'Bunny Bt', 'NHH 44', 'PKV Hy-2']],
  ['onion', ['Nashik Red', 'Agrifound Dark Red', 'Phule Samarth', 'Arka Kalyan']],
  ['pigeonpea', ['BDN 711', 'BDN 716', 'ASHA (ICPL 87119)']],
  ['tur', ['BDN 711', 'BDN 716', 'ASHA (ICPL 87119)']],
  ['chickpea', ['JG 11', 'JAKI 9218', 'Vishal', 'Phule G 0515']],
  ['maize', ['DHM 117', 'HQPM 1', 'Pratap QPM 1', 'NK 6240']],
  ['groundnut', ['JL 24', 'TAG 24', 'TG 37A', 'Girnar 3']],
  ['mustard', ['Pusa Mustard 21', 'Varuna', 'RH 749']],
  ['rice', ['Basmati (Pusa 1121)', 'IR 64', 'Ratna', 'Swarna MTU 7029']],
  ['paddy', ['Basmati (Pusa 1121)', 'IR 64', 'Ratna', 'Swarna MTU 7029']],
  ['sorghum', ['CSH 16', 'CSH 30', 'CSV 216 (Maldandi)']],
  ['jowar', ['CSH 16', 'CSH 30', 'CSV 216 (Maldandi)']],
  ['bajra', ['HB 3', 'ICTP 8203', 'Dhanashakti']],
  ['millet', ['HB 3', 'ICTP 8203', 'Dhanashakti']],
  ['tomato', ['Pusa Ruby', 'Arka Vikas', 'US 440 Hybrid', 'Phule Raja']],
  ['potato', ['Kufri Jyoti', 'Kufri Pukhraj', 'Kufri Chipsona']],
  ['grapes', ['Thompson Seedless', 'Sharad Seedless', 'Flame Seedless']],
  ['sugarcane', ['Co 86032', 'CoM 0265', 'VSI 434']],
  ['moong', ['SGC 16 (Samrat)', 'IPM 02-3', 'Kopargaon']],
  ['green gram', ['SGC 16 (Samrat)', 'IPM 02-3', 'Kopargaon']],
  ['urad', ['Pant U 31', 'KU 301', 'VBN 5']],
  ['black gram', ['Pant U 31', 'KU 301', 'VBN 5']],
  ['chilli', ['Byadgi', 'Guntur Sannam', 'Jwala', 'Phule Jyoti']],
  ['turmeric', ['Salem', 'Rajapuri', 'Krishna', 'Phule Swarupa']],
  ['garlic', ['Agrifound White', 'Yamuna Safed', 'Bhima Purple']],
  ['watermelon', ['Sugar Baby', 'Arka Jyoti', 'Dushyant']],
  ['banana', ['Grand Naine', 'Robusta', 'Dwarf Cavendish']],
  ['mango', ['Kesar', 'Alphonso (Hapus)', 'Totapuri', 'Langra']],
  ['pomegranate', ['Bhagwa', 'Ganesh', 'Arakta']],
  ['orange', ['Nagpur Mandarin', 'Mosambi (Satgudi)']],
  ['cauliflower', ['Pusa Katki', 'Phule Gauri', 'Him Palam']],
];

/** Marker value for the "Other (type your own)" option in variety pickers. */
export const OTHER_VARIETY = '__other__';

/** Catalog varieties for a typed crop name (empty when the crop is unknown). */
export const varietyOptionsFor = (crop: string): string[] => {
  const needle = (crop || '').trim().toLowerCase();
  if (needle.length < 2) return [];
  for (const [key, list] of CROP_VARIETIES) {
    if (needle.includes(key) || key.includes(needle)) return list;
  }
  return [];
};
