import { registerLocale } from '../index';

/**
 * Verdant Glass v2.0 strings — scene, AI bar, persona companion card, and
 * the persona-switch confirmation toast. Merged into `hi`.
 */

const hiVerdant: Record<string, string> = {
  // Universal AI bar (§8.9)
  vgAiPlaceholder: 'मैं आपकी क्या मदद करूँ?',
  vgAiMicAria: 'आवाज़ से पूछें',
  vgAiSendAria: 'अग्रोमित्र को भेजें',

  // Persona AI companion card (§8.5)
  vgMitraTitle: 'अग्रोमित्र',
  vgSeeDetails: 'विवरण देखें',

  // Persona-switch confirmation (§9.4)
  vgSwitchToast: '{persona} प्रोफ़ाइल सक्रिय',

  // Context-header stat pills (§7.2/§8.2)
  vgStatLocation: 'स्थान',
  vgStatLand: 'भूमि',
  vgStatTasks: 'खुले काम',
  vgStatSync: 'सिंक होना बाकी',

  // Metric tri-card (§8.3) — real data only
  vgKpiArea: 'क्षेत्र',
  vgKpiAcresUnit: 'एकड़',
  vgKpiOpenTasks: 'खुले काम',
  vgKpiReceivables: 'प्राप्ति बाकी',

  // Hero metric card (§8.4)
  vgHeroIrrigationCaption: 'आपकी भूमि में सिंचाई उपलब्ध है',
  vgHeroStatusOptimal: 'इष्टतम क्षेत्र',
  vgHeroStatusPlanned: 'योजना अधीन',
  vgHeroAddCrop: 'फसल जोड़ें',

  // Per-persona one-line advisory shown in the companion card.
  vgAdvice_farmer: 'इस सप्ताह हरी सब्ज़ियों की बुवाई के लिए मौसम अनुकूल है। सिंचाई सुबह के समय ही रखें।',
  vgAdvice_farmLandlord: 'दो पट्टे समझौते जल्द नवीनीकरण पर हैं। अगले चक्र से पहले किराया मानक देखें।',
  vgAdvice_transport: 'इस सप्ताह आपके मार्ग पर माँग बढ़ रही है। भोर की लोडिंग से पहले वाहन मंडी के पास रखें।',
  vgAdvice_seller: 'आपकी मंडी में प्याज़ की आवक 8% कम है। दो दिन मज़बूत कीमत रखने से मुनाफ़ा बढ़ सकता है।',
  vgAdvice_equipmentRental: 'अगले सप्ताह कटाई सीज़न की बुकिंग बढ़ेगी। अभी हार्वेस्टर की सर्विसिंग तय करें।',
  vgAdvice_broker: 'तीन खुली लीड आपके कमीशन दायरे में हैं। इस सप्ताह एक डील पक्की करें।',
  vgAdvice_dairyManager: 'शाम की खरीद बढ़ रही है। शाम 6 बजे से पहले केन धुलाई का समय निकालें।',
  vgAdvice_customer: 'आपकी नियमित टोकरी 12 किमी दूर के खेत से फिर उपलब्ध है। सुबह डिलीवरी के लिए रात 8 बजे से पहले ऑर्डर करें।',
  vgAdvice_directBuyer: 'आपके मानदंड पर दो ग्रेडेड लॉट आज सूचीबद्ध हुए। निरीक्षण स्लॉट जल्दी पक्का करें।',
  vgAdvice_instructor: 'आपका अगला बैच जल्द शुरू होता है। डेमो-प्लॉट स्लॉट और बीज किट सूची ताज़ा करें।',
  vgAdvice_default: 'आपकी दुनिया एक नज़र में — खेती, बाज़ार या कारोबार, कुछ भी पूछें।',
};

registerLocale('hi', hiVerdant);
