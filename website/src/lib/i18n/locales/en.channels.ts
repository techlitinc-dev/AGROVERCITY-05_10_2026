import { registerLocale } from '../index';

/**
 * Live Channels strings (phase-04 WS-05) — merged into `en`.
 * Key catalog is the contract for all views under views/channels/.
 */

const enChannels: Record<string, string> = {
  channelsTitle: 'Live Channels',
  channelsLive: 'LIVE',
  channelsRemindMe: 'Remind me',
  channelsSchedule: 'Schedule',
  channelsChatPlaceholder: 'Type a message…',
  channelsViewers: '{count} watching',
  channelsWatch: 'Watch',
  channelsLiveNow: 'Live now',
  channelsOffline: 'Offline',
  channelsPinned: 'Announcement',
  channelsPolls: 'Polls',
  channelsQuestions: 'Viewer Q&A',
  channelsAskPlaceholder: 'Ask a question…',
  channelsAsk: 'Ask',
  channelsUpvote: 'Upvote',
  channelsVote: 'Vote',
  channelsAnswered: 'Answered',
  channelsSend: 'Send',
  channelsBackToGrid: 'Back to channels',
  channelsEmpty: 'No live channels right now',
  channelsLoadFailed: 'Could not load channels — please try again',
  channelsNoPolls: 'No active polls',
  channelsNoQuestions: 'No questions yet',
  channelsEmptyChat: 'No messages yet — say hello 👋',
  channelsModerationBlocked: 'Message blocked: no phone numbers, UPI IDs or links',
};

registerLocale('en', enChannels);
