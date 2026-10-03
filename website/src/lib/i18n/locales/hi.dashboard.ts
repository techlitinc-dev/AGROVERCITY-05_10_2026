import { registerLocale } from '../index';

/** Dashboard / Action Center strings — हिंदी (en.dashboard.ts से पूरी समानता). */

const hiDashboard: Record<string, string> = {
  // ---- Sections ----
  dashActionHeroTitle: 'अगला सर्वोत्तम कदम',
  dashUrgentTitle: 'अभी ध्यान दें',
  dashTodayTitle: 'आज के काम',
  dashModulesTitle: 'आपके मॉड्यूल',
  dashMoneyTitle: 'धन सारांश',

  // ---- Task row actions ----
  dashTaskDone: 'पूरा हुआ',
  dashTaskDismiss: 'हटाएँ',
  dashTaskOpen: 'खोलें',
  dashTaskCheckAria: 'काम पूरा करें',
  dashTaskActionFailed: 'काम अपडेट नहीं हो सका — कृपया पुनः प्रयास करें',
  dashTaskBusyAria: 'काम अपडेट हो रहा है',

  // ---- Celebration ----
  dashTaskDoneToast: 'हो गया — बहुत बढ़िया!',
  dashCoinsEarned: '+{count} कृषि सिक्के',

  // ---- Empty + loading states ----
  dashNoUrgent: 'अभी कुछ अत्यावश्यक नहीं',
  dashNoTasks: 'आज कोई काम नहीं — सब पूरा है',
  dashNoHero: 'अभी कोई मुख्य काम नहीं',
  dashNoMoney: 'धन सारांश अभी उपलब्ध नहीं',
  dashLoadingSection: 'लोड हो रहा है…',
  dashLoadingTasksAria: 'आपके काम लोड हो रहे हैं',

  // ---- Aggregate mode ----
  dashAllProfiles: 'सभी प्रोफ़ाइल',
  dashAggregateHint: 'आपकी सभी प्रोफ़ाइलों के काम एक साथ।',

  // ---- Module grid ----
  dashModuleOpenCount: '{count} बाकी',
  dashModuleClear: 'सब ठीक',
  dashModule_trade: 'व्यापार',
  dashModule_transport: 'परिवहन',
  dashModule_equipment: 'यंत्र',
  dashModule_land: 'भूमि व पट्टे',
  dashModule_dairy: 'डेयरी',
  dashModule_courses: 'कोर्स',
  dashModule_broker: 'दलाल',
  dashModule_contracts: 'अनुबंध',
  dashModule_purchases: 'खरीद',

  // ---- Money snapshot ----
  dashReceivables: 'लंबित प्राप्तियाँ',
  dashPayables: 'लंबित देय',
  dashSettlements: 'लंबित निपटान',

  // ---- AI badges (shared with WS-03) ----
  dashAiBadge: 'AI सुझाव',
  dashAiConfidence: '{pct}% विश्वास',
};

registerLocale('hi', hiDashboard);
