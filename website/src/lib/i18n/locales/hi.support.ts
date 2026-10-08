import { registerLocale } from '../index';

/** Help center + AI support agent (phase-06 WS-05). */
const hiSupport: Record<string, string> = {
  'support.title': 'सहायता और समर्थन',
  'support.faq': 'अक्सर पूछे जाने वाले प्रश्न',
  'support.search': 'सहायता खोजें',
  'support.threads': 'सहायता थ्रेड',
  'support.askPlaceholder': 'प्रश्न पूछें…',
  'support.send': 'भेजें',
  'support.ticketCreated': 'एक सहायता टिकट बनाया गया — नीचे अपने थ्रेड देखें',
  'support.sources': 'स्रोत',
};

registerLocale('hi', hiSupport);
