import { registerLocale } from '../index';

/**
 * Live Channels strings — Hindi (merged into `hi`, falls back to en for gaps).
 */

const hiChannels: Record<string, string> = {
  channelsTitle: 'लाइव चैनल',
  channelsLive: 'लाइव',
  channelsRemindMe: 'मुझे याद दिलाएँ',
  channelsSchedule: 'कार्यक्रम',
  channelsChatPlaceholder: 'संदेश लिखें…',
  channelsViewers: '{count} देख रहे हैं',
  channelsWatch: 'देखें',
  channelsLiveNow: 'अभी लाइव',
  channelsOffline: 'ऑफ़लाइन',
  channelsPinned: 'घोषणा',
  channelsPolls: 'मतदान',
  channelsQuestions: 'दर्शक प्रश्न',
  channelsAskPlaceholder: 'प्रश्न पूछें…',
  channelsAsk: 'पूछें',
  channelsUpvote: 'अपवोट',
  channelsVote: 'वोट',
  channelsAnswered: 'उत्तर दिया गया',
  channelsSend: 'भेजें',
  channelsBackToGrid: 'चैनलों पर वापस जाएँ',
  channelsEmpty: 'अभी कोई लाइव चैनल नहीं',
  channelsLoadFailed: 'चैनल लोड नहीं हो सके — कृपया पुनः प्रयास करें',
  channelsNoPolls: 'कोई सक्रिय मतदान नहीं',
  channelsNoQuestions: 'अभी कोई प्रश्न नहीं',
  channelsEmptyChat: 'अभी कोई संदेश नहीं — नमस्ते कहें 👋',
  channelsModerationBlocked: 'संदेश अवरुद्ध: फ़ोन नंबर, UPI आईडी या लिंक नहीं',
};

registerLocale('hi', hiChannels);
