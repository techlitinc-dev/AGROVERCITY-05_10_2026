import { registerLocale } from '../index';

/**
 * Dairy sales / stock / reports strings (P6) — Hindi, merged into `hi`.
 * Missing keys fall through to the `en` dictionary (see lib/i18n).
 */

const hiDairySales: Record<string, string> = {
  // ---- Customer book ----
  dairySalesType_household: 'घरेलू',
  dairySalesType_shop: 'दुकान',
  dairySalesType_hotel: 'होटल',
  dairyCustomersSearch: 'नाम या रूट खोजें',
  dairyCustomersEmpty: 'अभी कोई ग्राहक नहीं',
  dairyCustomersEmptyBody: 'जो घर, दुकान या होटल आपसे दूध खरीदते हैं, उन्हें यहां जोड़ें।',
  dairyCustomerNew: 'ग्राहक जोड़ें',
  dairyCustomerEdit: 'ग्राहक बदलें',
  dairyCustomerNotFound: 'ग्राहक नहीं मिला',
  dairyCustomerCreated: 'ग्राहक जुड़ गया',
  dairyCustomerUpdated: 'ग्राहक अपडेट हो गया',
  dairyCustomerPhone: 'फोन (निजी खाता विवरण)',
  dairyCustomerType: 'ग्राहक प्रकार',
  dairyCustomerAddress: 'पता',
  dairyCustomerRoute: 'रूट / इलाका',
  dairyCustomerDailyAm: 'रोज़ का दूध (सुबह)',
  dairyCustomerDailyPm: 'रोज़ का दूध (शाम)',
  dairyCustomerRate: 'प्रति लीटर दर (₹)',
  dairyCustomerRateInvalid: 'दर ₹0 से ज़्यादा होनी चाहिए',
  dairyCustomerDailyNeed: 'रोज़ की ज़रूरत',

  // ---- Sale orders ----
  dairyOrdersEmpty: 'अभी कोई ऑर्डर नहीं',
  dairyOrdersEmptyBody: 'ग्राहकों के लिए सुबह/शाम की डिलीवरी ऑर्डर बनाएं और भुगतान तक ट्रैक करें।',
  dairyOrderNew: 'नया ऑर्डर',
  dairyOrderSheetTitle: 'नई बिक्री ऑर्डर',
  dairyOrderPickCustomer: 'ग्राहक',
  dairyOrderPickCustomerEmpty: 'कोई सक्रिय ग्राहक नहीं',
  dairyOrderPickCustomerEmptyBody: 'पहले ग्राहक जोड़ें — ऑर्डर सिर्फ सक्रिय ग्राहकों के लिए बनते हैं।',
  dairyOrderAmountPreview: 'राशि (लीटर × दर से अपने आप)',
  dairyOrderLitersInvalid: '0 से ज़्यादा लीटर लिखें',
  dairyOrderCreated: 'ऑर्डर तय हो गया',
  dairyOrderNotFound: 'ऑर्डर नहीं मिला',
  dairyOrderCustomer: 'ग्राहक',
  dairyOrderMarkDelivered: 'डिलीवर हो गया',
  dairyOrderMarkBilled: 'बिल बनाएं',
  dairyOrderMarkPaid: 'भुगतान लें',
  dairyOrderPaidNote: 'यह ऑर्डर चुकता हो गया है।',
  dairyOrderUpdated: 'ऑर्डर अपडेट हो गया',
  dairyOrderTransitionFailed: 'यह ऑर्डर कहीं और बदल गया — नई स्थिति दिखा रहे हैं।',

  // ---- Stock ----
  dairyStockEmpty: 'अभी कोई स्टॉक नहीं',
  dairyStockEmptyBody: 'दूध से बने उत्पाद — दही, घी, पनीर — की मात्रा और एक्सपायरी तारीख यहां रखें।',
  dairyStockAdd: 'आइटम जोड़ें',
  dairyStockAdjust: 'एडजस्ट करें',
  dairyStockName: 'आइटम का नाम',
  dairyStockCategory: 'श्रेणी',
  dairyStockUnit: 'इकाई (L, kg, pcs…)',
  dairyStockQty: 'स्टॉक मात्रा',
  dairyStockPrice: 'इकाई कीमत (₹)',
  dairyStockExpiry: 'एक्सपायरी तारीख',
  dairyStockItemCreated: 'आइटम जुड़ गया',
  dairyStockAdjusted: 'स्टॉक एडजस्ट हो गया',
  dairyStockDelta: 'बदलाव (+ / −)',
  dairyStockDeltaHint: 'स्टॉक घटाने के लिए ऋणात्मक संख्या लिखें, जैसे -2.5',
  dairyStockReason: 'कारण',
  dairyStockReasonRequired: 'कारण ज़रूरी है',
  dairyStockLastAdj: 'पिछला एडजस्टमेंट',
  dairyStockExpiredTag: 'एक्सपायर हो गया',
  dairyStockExpiresSoonTag: '{days} दिन बचे',
  dairyStockCat_milk: 'दूध',
  dairyStockCat_curd: 'दही',
  dairyStockCat_ghee: 'घी',
  dairyStockCat_paneer: 'पनीर',
  dairyStockCat_other: 'अन्य',

  // ---- Reports ----
  dairyReportsDailyTitle: 'दैनिक रिपोर्ट',
  dairyReportsPlTitle: 'महीने का लाभ-हानि',
  dairyReportsSales: 'बिक्री',
  dairyReportClosingStock: 'बचा हुआ स्टॉक',
  dairyReportProcurementCost: 'खरीद लागत',
  dairyReportSalesIncome: 'बिक्री आय',
  dairyReportGrossProfit: 'सकल लाभ',
  dairyReportXCollections: '{count} कलेक्शन',
  dairyReportXOrders: '{count} ऑर्डर',
  dairyReportNoStock: 'अभी कोई स्टॉक नहीं है।',
};

registerLocale('hi', hiDairySales);
