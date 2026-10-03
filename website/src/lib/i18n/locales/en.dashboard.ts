import { registerLocale } from '../index';

/**
 * Dashboard / Action Center strings (phase-01 WS-02) — merged into `en`.
 * Every string with a number takes it as a `t()` param; never bake numbers in.
 */

const enDashboard: Record<string, string> = {
  // ---- Sections ----
  dashActionHeroTitle: 'Next best action',
  dashUrgentTitle: 'Needs attention now',
  dashTodayTitle: "Today's tasks",
  dashModulesTitle: 'Your modules',
  dashMoneyTitle: 'Money snapshot',

  // ---- Task row actions ----
  dashTaskDone: 'Done',
  dashTaskDismiss: 'Dismiss',
  dashTaskOpen: 'Open',
  dashTaskCheckAria: 'Mark task as done',
  dashTaskActionFailed: 'Could not update the task — please try again',
  dashTaskBusyAria: 'Task update in progress',

  // ---- Celebration ----
  dashTaskDoneToast: 'Done — nice work!',
  dashCoinsEarned: '+{count} AgriCoins',

  // ---- Empty + loading states ----
  dashNoUrgent: 'Nothing urgent right now',
  dashNoTasks: "No tasks today — you're all caught up",
  dashNoHero: 'No headline task yet',
  dashNoMoney: 'Money snapshot unavailable right now',
  dashLoadingSection: 'Loading…',
  dashLoadingTasksAria: 'Loading your tasks',

  // ---- Aggregate mode ----
  dashAllProfiles: 'All profiles',
  dashAggregateHint: 'Combines tasks from every profile you have.',

  // ---- Module grid ----
  dashModuleOpenCount: '{count} open',
  dashModuleClear: 'All clear',
  dashModule_trade: 'Trade',
  dashModule_transport: 'Transport',
  dashModule_equipment: 'Equipment',
  dashModule_land: 'Land & Leases',
  dashModule_dairy: 'Dairy',
  dashModule_courses: 'Courses',
  dashModule_broker: 'Broker',
  dashModule_contracts: 'Contracts',
  dashModule_purchases: 'Purchases',

  // ---- Money snapshot ----
  dashReceivables: 'Pending receivables',
  dashPayables: 'Pending payables',
  dashSettlements: 'Pending settlements',

  // ---- AI badges (shared with WS-03) ----
  dashAiBadge: 'AI sujhav',
  dashAiConfidence: '{pct}% confident',
};

registerLocale('en', enDashboard);
