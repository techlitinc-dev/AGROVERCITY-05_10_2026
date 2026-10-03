import { api } from './client';

/** Kisan Mitra chat wrappers (phase-01 WS-04). Writes get Idempotency-Key from client.ts. */

export interface ChatbotMessage {
  id: string;
  sessionId: string;
  sender: string;
  text: string;
  timestamp: string;
  language?: string;
  richCardType?: string | null;
  richCardData?: Record<string, unknown> | null;
  quickReplies?: string[];
  suggestedActions?: Array<Record<string, unknown>>;
  audioUrl?: string | null;
  isExpertHandoffSuggested?: boolean;
}

export interface ExpertHandoffResult {
  ticketId: string;
  status: string;
  category: string;
  urgency: string;
  assignedDesk: string;
  estimatedWaitMinutes: number;
  createdAt: string;
}

export interface ExpertTicket {
  id: string;
  userId: string;
  sessionId?: string | null;
  query: string;
  category: string;
  urgency: string;
  crop?: string | null;
  status: string;
  assignedDesk: string;
  createdAt: string;
  estimatedWaitMinutes?: number;
}

/** Persisted chat history record (users/{uid}/chatbot_messages doc). */
export interface ChatbotHistoryRecord {
  id: string;
  sessionId: string;
  userId: string;
  userQuery: string;
  botResponse: string;
  richCardType?: string | null;
  richCardData?: Record<string, unknown> | null;
  timestamp: string;
}

export interface Expert {
  id: string;
  name: string;
  title: string;
  institution: string;
  languages: string[];
  specialization: string;
  isOnline: boolean;
  nextSlot: string;
}

export async function sendMessage(text: string, sessionId?: string, language?: string): Promise<ChatbotMessage> {
  const { data } = await api.post<ChatbotMessage>('/chatbot/messages', {
    text,
    ...(sessionId ? { sessionId } : {}),
    ...(language ? { language } : {}),
  });
  return data;
}

export async function getHistory(
  sessionId?: string
): Promise<{ data: ChatbotHistoryRecord[]; total: number }> {
  const { data } = await api.get<{ data: ChatbotHistoryRecord[]; total: number }>(
    '/chatbot/history',
    { params: sessionId ? { sessionId } : {} }
  );
  return data;
}

export async function requestHandoff(input: {
  query: string;
  category?: string;
  urgency?: string;
  sessionId?: string;
  crop?: string;
}): Promise<ExpertHandoffResult> {
  const { data } = await api.post<ExpertHandoffResult>('/chatbot/expert-handoff', input);
  return data;
}

export async function listHandoffs(): Promise<{ data: ExpertTicket[]; total: number }> {
  const { data } = await api.get<{ data: ExpertTicket[]; total: number }>('/chatbot/handoffs');
  return data;
}

export async function listExperts(): Promise<{ data: Expert[]; total: number }> {
  const { data } = await api.get<{ data: Expert[]; total: number }>('/chatbot/experts');
  return data;
}
