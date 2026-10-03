import { registerLocale } from '../index';

/**
 * Dairy ops strings — Hindi (P4 collections + P5 payment batches).
 * Dairy vocabulary: slip→पर्ची, payment→भुगतान, batch→बैच,
 * morning shift→सुबह, evening shift→शाम.
 */

const hiDairyOps: Record<string, string> = {
  // ---- Collections ledger (P4) ----
  dairyOpsLedgerDate: 'कलेक्शन तारीख',
  dairyOpsLedgerEmpty: 'इस तारीख को कोई पर्ची दर्ज नहीं',
  dairyOpsLedgerEmptyBody: 'कोई और तारीख चुनें या आज का पहला कलेक्शन दर्ज करें।',

  // ---- Collection entry (P4) ----
  dairyOpsEntryPickMember: 'आगे बढ़ने के लिए सदस्य चुनें',
  dairyOpsEntryLitersRange: '0 से 2000 के बीच लीटर लिखें',
  dairyOpsEntryFatRange: 'फैट % 2 से 14 के बीच होना चाहिए',
  dairyOpsEntrySnfRange: 'एसएनएफ % 6 से 14 के बीच होना चाहिए',
  dairyOpsEntryDuplicateWarn: 'इस सदस्य और पाली की पर्ची आज पहले से है — फिर भी सहेजें?',
  dairyOpsEntrySaveSlip: 'पर्ची सहेजें',
  dairyOpsEntrySaved: 'पर्ची सहेजी गई',
  dairyOpsEntrySuccessTitle: 'पर्ची दर्ज हो गई',
  dairyOpsEntryNextMember: 'अगला सदस्य',

  // ---- Payment batches (P5) ----
  dairyOpsPayGenerate: 'बैच बनाएं',
  dairyOpsPayPickPeriod: 'सही अवधि चुनें — शुरुआती तारीख अंतिम तारीख से पहले होनी चाहिए',
  dairyOpsPayGenerated: 'भुगतान बैच बन गया',
  dairyOpsPayEmpty: 'अभी कोई भुगतान बैच नहीं',
  dairyOpsPayEmptyBody:
    'बैच किसी अवधि (जैसे 1–15 तारीख) में हर सदस्य के कलेक्शन जोड़ता है, कटौती लागू करता है और फिर सबका भुगतान एक साथ होता है।',

  // ---- Batch detail (P5) ----
  dairyOpsBatchNotFound: 'बैच नहीं मिला',
  dairyOpsBatchNoEntries: 'इस अवधि में कोई कलेक्शन नहीं',
  dairyOpsBatchNoEntriesBody:
    'इस बैच में कोई सदस्य एंट्री नहीं है, इसलिए देने योग्य राशि नहीं है। इस अवधि के कलेक्शन अगले बैच में दिखेंगे।',
  dairyOpsBatchEntriesTitle: 'सदस्य भुगतान',
  dairyOpsBatchEntriesNote: 'एंट्री की पंक्तियां बैच बनाते ही दिखती हैं; दोबारा खोलने पर सिर्फ कुल योग दिखता है।',
  dairyOpsBatchMarkPaid: 'भुगतान पूरा करें',
  dairyOpsBatchPayoutRef: 'भुगतान संदर्भ (वैकल्पिक)',
  dairyOpsBatchPayoutRefHint: 'खाली छोड़ें तो UTR संदर्भ अपने आप बन जाएगा।',
  dairyOpsBatchConfirmTitle: 'बैच का भुगतान पूरा करें?',
  dairyOpsBatchConfirmBody:
    'इस बैच की हर सदस्य एंट्री भुगतान पूर्ण मार्क होगी और हर सदस्य को सूचना जाएगी। इसे वापस नहीं किया जा सकता।',
  dairyOpsBatchPaid: 'बैच का भुगतान हो गया',
  dairyOpsBatchAlreadyPaid: 'इस बैच का भुगतान पहले ही हो चुका है',
  dairyOpsBatchPaidAt: 'भुगतान समय',
};

registerLocale('hi', hiDairyOps);
