export type NewsCategory = 'marketPolicy' | 'weatherAlert' | 'govtSubsidy' | 'agriTech';

export interface AgriNewsItem {
  id: string;
  title: string;
  vernacularTitle: string;
  category: NewsCategory;
  source: string;
  timestamp: string;
  summary: string;
  content: string;
  isBreaking: boolean;
  audioText: string;
  impactRating: number;
}

export interface AgriLiveChannel {
  id: string;
  channelName: string;
  vernacularName: string;
  broadcaster: string;
  programTitle: string;
  vernacularProgram: string;
  currentSpeaker: string;
  liveViewersCount: number;
  isLiveNow: boolean;
  category: string;
  streamThumbnail: string;
  streamUrl: string;
  scheduleTime: string;
}

export interface ChannelChatMessage {
  id: string;
  senderName: string;
  text: string;
  at: string;
}

export interface PaidWorkshop {
  id: string;
  title: string;
  vernacularTitle: string;
  instructor: string;
  instructorRole: string;
  institution: string;
  feeRupees: number;
  coinsDiscountAllowed: boolean;
  duration: string;
  batchDate: string;
  timing: string;
  rating: number;
  enrolledCount: number;
  totalSeats: number;
  isCertified: boolean;
  certificateTitle: string;
  syllabusModules: string[];
  deliverables: string[];
  isEnrolled: boolean;
}

export interface ExpertTalk {
  id: string;
  expertName: string;
  institution: string;
  topic: string;
  vernacularTopic: string;
  scheduledTime: string;
  isLive: boolean;
  registeredCount: number;
  expertAvatar: string;
  description: string;
}

export interface VideoGuide {
  id: string;
  title: string;
  vernacularTitle: string;
  instructor: string;
  duration: string;
  views: string;
  category: string;
  videoUrl: string;
  summary: string;
  keyPoints: string[];
}

export interface BlogArticle {
  id: string;
  title: string;
  vernacularTitle: string;
  author: string;
  authorRole: string;
  readTimeMinutes: number;
  category: string;
  summary: string;
  content: string;
  publishedDate: string;
  likesCount: number;
  isBookmarked: boolean;
}
