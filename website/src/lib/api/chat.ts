import { api } from './client';

/**
 * Booking-gated chat (spec §4) — rooms are created by the BOOKING_CONFIRMED
 * event; no user search / no pre-booking chat exists (spec G1).
 * Verified against backend/app/routers/chat.py.
 */

export interface ChatRoom {
  id: string;
  /** 'offer' = negotiation thread; 'purchase' = booking chat; 'direct' = simple 1:1;
   *  'batch' = instructor broadcast room (WS-02 task 2.35). */
  kind?: 'offer' | 'purchase' | 'direct' | 'batch';
  purchaseId?: string;
  offerId?: string;
  batchId?: string;
  instructorId?: string;
  memberIds?: string[];
  sealed?: boolean;
  farmerId: string;
  farmerName: string;
  buyerId: string;
  buyerName: string;
  crop: string;
  createdAt: string;
  lastMessageAt?: string | null;
  lastMessageText?: string;
  /** Server-enriched per viewer. */
  counterpartyName?: string;
  unread?: boolean;
  /** Present on getChatRoom: thread is closed (read-only archive). */
  terminal?: boolean;
}

export interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  fromSide: 'farmer' | 'buyer';
  text: string;
  imageUrl?: string | null;
  /** In-platform lesson card reference (batch chat only). */
  lessonCardId?: string | null;
  createdAt: string;
}

export async function listChatRooms(): Promise<{ data: ChatRoom[]; total: number }> {
  const { data } = await api.get<{ data: ChatRoom[]; total: number }>('/chat/rooms');
  return data;
}

export async function getChatRoom(purchaseId: string): Promise<ChatRoom> {
  const { data } = await api.get<ChatRoom>(`/chat/rooms/${purchaseId}`);
  return data;
}

export async function listMessages(
  purchaseId: string,
  page = 1,
  pageSize = 30
): Promise<{ data: ChatMessage[]; page: number; pageSize: number; total: number }> {
  const { data } = await api.get(`/chat/rooms/${purchaseId}/messages`, {
    params: { page, pageSize },
  });
  return data;
}

export async function postMessage(
  purchaseId: string,
  payload: { text?: string; imageUrl?: string }
): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(`/chat/rooms/${purchaseId}/messages`, payload);
  return data;
}

export async function markRoomRead(purchaseId: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(`/chat/rooms/${purchaseId}/read`);
  return data;
}

/** Simple direct chat ("chat with farmer/seller") — scoped to a listing. */
export async function openDirectChat(payload: {
  lotId?: string;
  demandId?: string;
}): Promise<ChatRoom> {
  const { data } = await api.post<ChatRoom>('/chat/direct', payload);
  return data;
}

/**
 * Batch group chat (WS-02 task 2.35/2.40). One room per batch; the instructor
 * is admin and may only broadcast (text + in-platform lesson cards). Conversation
 * room id is the batch id. Backend: GET /v1/chat/rooms/{batchId}.
 */
export async function getBatchRoom(batchId: string): Promise<ChatRoom> {
  const { data } = await api.get<ChatRoom>(`/chat/rooms/${batchId}`);
  return data;
}

/** POST a broadcast to a batch room — text plus an optional lesson card id. */
export async function postBatchMessage(
  roomId: string,
  text: string,
  lessonCardId?: string
): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(`/chat/rooms/${roomId}/messages`, {
    text,
    lessonCardId: lessonCardId ?? '',
  });
  return data;
}
