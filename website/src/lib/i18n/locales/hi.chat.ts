import { registerLocale } from '../index';

/** Chat hub + moderation strike notices (phase-06 WS-01). */
const hiChat: Record<string, string> = {
  'chat.strikeWarning':
    'यह संदेश रोका गया: फोन नंबर, UPI आईडी या लिंक साझा करना मना है। चेतावनी {count} / 3।',
  'chat.muted24h': 'बार-बार उल्लंघन के कारण आप 24 घंटे के लिए चैट से प्रतिबंधित हैं।',
  'chat.suspended': 'एडमिन समीक्षा तक आपकी चैट निलंबित है।',
};

registerLocale('hi', hiChat);
