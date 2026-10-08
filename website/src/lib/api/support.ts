import { api } from './client';

/** Help center / support API (WS-05 F20 + M30). */

export interface FaqArticle {
  id: string;
  category: string;
  lang: string;
  title: string;
  body: string;
  status: string;
}

export interface SupportTicket {
  id: string;
  query: string;
  category?: string;
  status: string;
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorUid: string;
  authorRole: 'user' | 'agent';
  text: string;
  createdAt: string;
}

export type SupportAnswer =
  | { kind: 'answer'; answer: string; sources: string[] }
  | { kind: 'ticket'; ticketId: string };

export async function listFaq(lang: string, category?: string): Promise<FaqArticle[]> {
  const { data } = await api.get<{ data: FaqArticle[] }>('/faq', { params: { lang, category } });
  return data.data ?? [];
}

/** Client-side keyword filter over the fetched FAQ list (title + body). */
export async function searchFaq(lang: string, query: string): Promise<FaqArticle[]> {
  const articles = await listFaq(lang);
  const q = query.trim().toLowerCase();
  if (!q) return articles;
  return articles.filter(
    (a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)
  );
}

export async function listTickets(): Promise<SupportTicket[]> {
  const { data } = await api.get<{ data: SupportTicket[] }>('/chatbot/expert-tickets');
  return data.data ?? [];
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data } = await api.get<{ data: TicketMessage[] }>(
    `/chatbot/expert-tickets/${ticketId}/messages`
  );
  return data.data ?? [];
}

export async function postTicketMessage(ticketId: string, text: string): Promise<TicketMessage> {
  const { data } = await api.post<TicketMessage>(
    `/chatbot/expert-tickets/${ticketId}/messages`,
    { text }
  );
  return data;
}

export async function askSupport(question: string, lang = 'en'): Promise<SupportAnswer> {
  const { data } = await api.post<SupportAnswer>('/support/ask', { question, lang });
  return data;
}
