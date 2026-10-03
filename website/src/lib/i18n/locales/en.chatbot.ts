import { registerLocale } from '../index';

/** Kisan Mitra chat sheet strings (phase-01 WS-04) — merged into `en`. */

const enChatbot: Record<string, string> = {
  kmFab: 'Kisan Mitra',
  kmTitle: 'Kisan Mitra — AI advisor',
  kmInputPlaceholder: 'Ask about crops, mandi, weather…',
  kmSend: 'Send',
  kmTyping: 'Kisan Mitra is typing…',
  kmClose: 'Close',
  kmEmpty: 'Ask your first question — Kisan Mitra replies in your language.',
  kmHistoryFailed: 'Could not load the conversation',
  kmSendFailed: 'Message could not be sent — please try again',
  kmHandoffOffer: 'Talk to an expert',
  kmHandoffRequested: 'Expert request sent',
  kmHandoffFailed: 'Could not reach the expert desk — please try again',
  kmHandoffThreadTitle: 'Expert reply pending',
  kmHandoffStatus: 'Status: {status}',
  kmHandoffDesk: 'Desk: {desk}',
  kmSafeFallbackNote: 'Safety filter applied to this reply',
};

registerLocale('en', enChatbot);
