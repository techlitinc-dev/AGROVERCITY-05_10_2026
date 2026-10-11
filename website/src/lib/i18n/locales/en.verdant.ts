import { registerLocale } from '../index';

/**
 * Verdant Glass v2.0 strings — scene, AI bar, persona companion card, and
 * the persona-switch confirmation toast. Merged into `en`.
 */

const enVerdant: Record<string, string> = {
  // Universal AI bar (§8.9)
  vgAiPlaceholder: 'How can I help you?',
  vgAiMicAria: 'Voice input',
  vgAiSendAria: 'Send to AgroMitra',

  // Persona AI companion card (§8.5)
  vgMitraTitle: 'AgroMitra',
  vgSeeDetails: 'See details',

  // Persona-switch confirmation (§9.4)
  vgSwitchToast: '{persona} profile active',

  // Context-header stat pills (§7.2/§8.2)
  vgStatLocation: 'Location',
  vgStatLand: 'Holding',
  vgStatTasks: 'Open tasks',
  vgStatSync: 'Waiting to sync',

  // Metric tri-card (§8.3) — real data only
  vgKpiArea: 'Area',
  vgKpiAcresUnit: 'acres',
  vgKpiOpenTasks: 'Open tasks',
  vgKpiReceivables: 'Receivables',

  // Hero metric card (§8.4)
  vgHeroIrrigationCaption: 'of your holding has irrigation coverage',
  vgHeroStatusOptimal: 'Optimal zone',
  vgHeroStatusPlanned: 'Coverage planned',
  vgHeroAddCrop: 'Add crop',

  // Per-persona one-line advisory shown in the companion card.
  vgAdvice_farmer: 'Conditions look ideal for sowing leafy vegetables this week. Keep irrigation on the morning cycle.',
  vgAdvice_farmLandlord: 'Two lease agreements are nearing renewal. Review rent benchmarks before the next cycle.',
  vgAdvice_transport: 'Demand on your route is rising this week. Position your vehicle near the mandi before dawn loading.',
  vgAdvice_seller: 'Arrivals of onion are down 8% at your mandi. A firm price hold for two days may improve margins.',
  vgAdvice_equipmentRental: 'Harvest season bookings spike next week. Confirm your harvester servicing schedule now.',
  vgAdvice_broker: 'Three open leads match your commission band. Closing one this week keeps you on track for the month.',
  vgAdvice_dairyManager: 'Evening collection is trending up. Schedule can washing before the 6 PM shift to avoid delay.',
  vgAdvice_customer: 'Your regular basket is back in stock from a farm 12 km away. Order before 8 PM for morning delivery.',
  vgAdvice_directBuyer: 'Two graded lots matching your spec were listed today. Lock the inspection slot early.',
  vgAdvice_instructor: 'Your next batch starts soon. Refresh the demo-plot slot booking and seed kit checklist.',
  vgAdvice_default: 'Your world at a glance — ask me anything about your farm, market, or business.',
};

registerLocale('en', enVerdant);
