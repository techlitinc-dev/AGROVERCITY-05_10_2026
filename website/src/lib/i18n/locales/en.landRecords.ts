import { registerLocale } from '../index';

/**
 * Land & Legal (7/12 / 8A) strings — merged into `en`.
 * Key catalog is the contract for every view under views/land/.
 */

const enLandRecords: Record<string, string> = {
  landRecordsTitle: '7/12 & 8A land records',
  landRecordSampleLabel: 'sample data — not an official record',
  landRecordSampleShort: 'sample data',
  landRecordSearchHint: 'Search by Gat number or by village name.',

  landRecordSearchGat: 'Gat number',
  landRecordSearchVillage: 'Village',
  landRecordSearchDistrict: 'District',
  landRecordType712: '7/12 — ownership',
  landRecordType8A: '8A — cultivation',
  landRecordSearch: 'Search records',
  landRecordSearchNeedParam: 'Enter a Gat number or a village name.',
  landRecordSearchEmpty: 'No record found for this search.',
  landRecordSearchFailed: 'Could not load land records.',

  landRecordOwner: 'Owner',
  landRecordKhata: 'Khata no.',
  landRecordArea: 'Area',
  landRecordHectares: 'Hectares',
  landRecordLandClass: 'Land class',
  landRecordFerfar: 'Ferfar',
  landRecordCropHistory: 'Crop history',
  landRecordVillage: 'Village',
  landRecordDistrict: 'District',
  landRecordView: 'View record',

  landRecordSection712: '7/12 — ownership details',
  landRecordSection8A: '8A — cultivation details',

  landRecordPdf: 'View sample PDF',
  landRecordPdfUnavailable: 'PDF is not available for this record.',
  landRecordImport: 'Import area to my farm profile',
  landRecordImported: 'Imported {area} acres into your farm profile.',
  landRecordImportFailed: 'Could not import the survey area.',

  landRecordNotFound: 'This record could not be found.',
  landRecordBackToSearch: 'Back to search',
};

registerLocale('en', enLandRecords);
