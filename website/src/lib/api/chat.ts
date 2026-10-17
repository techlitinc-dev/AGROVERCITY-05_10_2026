import { post, readList, readOne } from './http';

/** Chat namespace — rooms, messages, direct. */
export const chat = {
  /** GET /chat/rooms */
  rooms: (): Promise<unknown[]> => readList<unknown[]>('/chat/rooms'),

  /** GET /chat/rooms/{id} */
  room: (roomId: string): Promise<unknown> => readOne<unknown>(`/chat/rooms/${roomId}`),

  /** POST /chat/direct — open (or get) a direct room with another user. */
  direct: (userId: string): Promise<unknown> => post<unknown>('/chat/direct', { userId }),

  /** GET /chat/rooms/{id}/messages */
  messages: (roomId: string, params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>(`/chat/rooms/${roomId}/messages`, { params }),

  /** POST /chat/rooms/{id}/messages */
  send: (roomId: string, text: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/chat/rooms/${roomId}/messages`, { text, ...payload }),

  /** POST /chat/rooms/{id}/read — mark room read. */
  markRead: (roomId: string): Promise<unknown> => post<unknown>(`/chat/rooms/${roomId}/read`),
};
