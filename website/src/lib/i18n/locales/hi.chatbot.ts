import { registerLocale } from '../index';

/** किसान मित्र चैट शीट (phase-01 WS-04) — en.chatbot.ts से पूरी समानता। */

const hiChatbot: Record<string, string> = {
  kmFab: 'किसान मित्र',
  kmTitle: 'किसान मित्र — AI सलाहकार',
  kmInputPlaceholder: 'फसल, मंडी, मौसम के बारे में पूछें…',
  kmSend: 'भेजें',
  kmTyping: 'किसान मित्र लिख रहा है…',
  kmClose: 'बंद करें',
  kmEmpty: 'अपना पहला सवाल पूछें — किसान मित्र आपकी भाषा में जवाब देगा।',
  kmHistoryFailed: 'बातचीत लोड नहीं हो सकी',
  kmSendFailed: 'संदेश नहीं भेजा जा सका — कृपया पुनः प्रयास करें',
  kmHandoffOffer: 'विशेषज्ञ से बात करें',
  kmHandoffRequested: 'विशेषज्ञ अनुरोध भेजा गया',
  kmHandoffFailed: 'विशेषज्ञ डेस्क तक नहीं पहुँच सके — कृपया पुनः प्रयास करें',
  kmHandoffThreadTitle: 'विशेषज्ञ का जवाब प्रतीक्षित',
  kmHandoffStatus: 'स्थिति: {status}',
  kmHandoffDesk: 'डेस्क: {desk}',
  kmSafeFallbackNote: 'इस जवाब पर सुरक्षा फ़िल्टर लगाया गया',
};

registerLocale('hi', hiChatbot);
