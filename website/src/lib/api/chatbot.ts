import { post, readList, readOne } from './http';

/** AI chatbot namespace — messages, history, expert handoff. */
export const chatbot = {
  /** POST /chatbot/messages */
  sendMessage: (message: string, context: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>('/chatbot/messages', { message, ...context }),

  /** GET /chatbot/history */
  history: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/chatbot/history', { params }),

  /** POST /chatbot/expert-handoff */
  expertHandoff: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/chatbot/expert-handoff', payload),

  /** GET /chatbot/handoffs */
  handoffs: (): Promise<unknown[]> => readList<unknown[]>('/chatbot/handoffs'),

  /** GET /chatbot/expert-tickets */
  expertTickets: (): Promise<unknown[]> => readList<unknown[]>('/chatbot/expert-tickets'),

  /** GET /chatbot/expert-tickets/{id}/messages */
  ticketMessages: (ticketId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/chatbot/expert-tickets/${ticketId}/messages`),

  /** POST /chatbot/expert-tickets/{id}/messages */
  postTicketMessage: (ticketId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/chatbot/expert-tickets/${ticketId}/messages`, payload),

  /** GET /chatbot/experts */
  experts: (): Promise<unknown[]> => readList<unknown[]>('/chatbot/experts'),
};
