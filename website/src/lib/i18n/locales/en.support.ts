import { registerLocale } from '../index';

/** Help center + AI support agent (phase-06 WS-05). */
const enSupport: Record<string, string> = {
  'support.title': 'Help & support',
  'support.faq': 'Frequently asked questions',
  'support.search': 'Search help',
  'support.threads': 'Support threads',
  'support.askPlaceholder': 'Ask a question…',
  'support.send': 'Send',
  'support.ticketCreated': 'A support ticket was created — check your threads below',
  'support.sources': 'Sources',
};

registerLocale('en', enSupport);
