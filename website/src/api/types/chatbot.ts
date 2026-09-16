export type ChatSender = 'bot' | 'user';
export type RichCardType = 'saturation' | 'weather' | 'mandi' | 'pest' | null;

export interface KisanMitraMessage {
  id: string;
  sender: ChatSender;
  text: string;
  timestamp: string;
  quickReplies: string[];
  richCardType: RichCardType;
  richCardData: Record<string, unknown>;
}

export interface ChatbotSendBody {
  text?: string;
  audioUrl?: string;
  language: string;
  sessionId: string;
}

export interface HandoffBody {
  sessionId: string;
  reason: string;
}

export interface HandoffRes {
  expertName: string;
  contactChannel: string;
  etaMinutes: number;
  threadId?: string;
}

export interface Weather {
  tempC: number;
  rainProbability: number;
  condition: string;
  radarAvailable: boolean;
  forecast: { date: string; minC: number; maxC: number; rainChancePct: number; condition: string }[];
}

export interface WeatherForecastDay {
  date: string;
  minC: number;
  maxC: number;
  rainChancePct: number;
  condition: string;
  sprayWindow: 'none' | 'morning' | 'evening';
}

export interface WeatherForecast {
  location: { district: string; lat: number; lng: number };
  today: { tempC: number; humidityPct: number; windKmh: number; rainChancePct: number; condition: string };
  days: WeatherForecastDay[];
  alerts: { severity: string; headline: string; validUntil: string }[];
  sprayAdvice: string;
}
