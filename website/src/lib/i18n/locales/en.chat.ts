import { registerLocale } from '../index';

/** Chat hub + moderation strike notices (phase-06 WS-01). */
const enChat: Record<string, string> = {
  'chat.strikeWarning':
    'This message was blocked: sharing phone numbers, UPI IDs or links is not allowed. Warning {count} of 3.',
  'chat.muted24h': 'You are muted from chat for 24 hours due to repeated violations.',
  'chat.suspended': 'Your chat is suspended pending admin review.',
};

registerLocale('en', enChat);
