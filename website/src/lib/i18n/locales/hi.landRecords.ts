import { registerLocale } from '../index';

/**
 * Land & Legal (7/12 / 8A) strings — merged into `hi`.
 * Same key set as `en.landRecords.ts` (parity-checked).
 */

const hiLandRecords: Record<string, string> = {
  landRecordsTitle: '७/१२ व ८अ भूमि रिकॉर्ड',
  landRecordSampleLabel: 'नमूना डेटा — यह आधिकारिक रिकॉर्ड नहीं है',
  landRecordSampleShort: 'नमूना डेटा',
  landRecordSearchHint: 'गट क्रमांक या गांव के नाम से खोजें।',

  landRecordSearchGat: 'गट क्रमांक',
  landRecordSearchVillage: 'गांव',
  landRecordSearchDistrict: 'जिला',
  landRecordType712: '७/१२ — मालिकाना',
  landRecordType8A: '८अ — खेती',
  landRecordSearch: 'रिकॉर्ड खोजें',
  landRecordSearchNeedParam: 'गट क्रमांक या गांव का नाम दर्ज करें।',
  landRecordSearchEmpty: 'इस खोज के लिए कोई रिकॉर्ड नहीं मिला।',
  landRecordSearchFailed: 'भूमि रिकॉर्ड लोड नहीं हो सके।',

  landRecordOwner: 'मालिक',
  landRecordKhata: 'खाता क्रमांक',
  landRecordArea: 'क्षेत्र',
  landRecordHectares: 'हेक्टेयर',
  landRecordLandClass: 'भूमि वर्ग',
  landRecordFerfar: 'फेरफार',
  landRecordCropHistory: 'फसल इतिहास',
  landRecordVillage: 'गांव',
  landRecordDistrict: 'जिला',
  landRecordView: 'रिकॉर्ड देखें',

  landRecordSection712: '७/१२ — मालिकाना विवरण',
  landRecordSection8A: '८अ — खेती विवरण',

  landRecordPdf: 'नमूना PDF देखें',
  landRecordPdfUnavailable: 'इस रिकॉर्ड के लिए PDF उपलब्ध नहीं है।',
  landRecordImport: 'क्षेत्र मेरे फार्म प्रोफ़ाइल में जोड़ें',
  landRecordImported: '{area} एकड़ आपकी फार्म प्रोफ़ाइल में जोड़ दिए गए।',
  landRecordImportFailed: 'सर्वेक्षण क्षेत्र जोड़ा नहीं जा सका।',

  landRecordNotFound: 'यह रिकॉर्ड नहीं मिला।',
  landRecordBackToSearch: 'खोज पर वापस जाएं',
};

registerLocale('hi', hiLandRecords);
