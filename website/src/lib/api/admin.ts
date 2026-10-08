import { api } from './client';

/**
 * Minimal admin API wrappers (WS-01/WS-03). The full console styling lands in
 * phase-07; these back the plain queue pages shipped this phase.
 */

export interface ModerationQueueItem {
  contentType: string;
  contentId: string;
  flag: boolean;
  reason: string;
  decisionId: string;
  status: string;
  createdAt: string;
}

export async function getModerationQueue(
  cursor?: string,
  limit = 20
): Promise<{ data: ModerationQueueItem[]; nextCursor: string | null }> {
  const { data } = await api.get<{ data: ModerationQueueItem[]; nextCursor: string | null }>(
    '/admin/moderation-queue',
    { params: { cursor, limit } }
  );
  return data;
}

export interface FraudQueueItem {
  userId: string;
  pattern: string;
  risk: number;
  decisionId: string;
  reason: string;
  status: string;
  createdAt: string;
}

export async function getFraudQueue(
  cursor?: string,
  limit = 20
): Promise<{ data: FraudQueueItem[]; nextCursor: string | null }> {
  const { data } = await api.get<{ data: FraudQueueItem[]; nextCursor: string | null }>(
    '/admin/fraud-queue',
    { params: { cursor, limit } }
  );
  return data;
}

export interface SettlementHold {
  id: string;
  entityId: string;
  role: string;
  netRupees: number;
  holdReason?: string;
  decisionId?: string;
  status: string;
}

export async function getSettlementHolds(): Promise<SettlementHold[]> {
  const { data } = await api.get<{ data: SettlementHold[] }>('/settlements/holds');
  return data.data ?? [];
}

export async function releaseSettlementHold(lineId: string, reason: string): Promise<unknown> {
  const { data } = await api.post(`/settlements/holds/${lineId}/release`, { reason });
  return data;
}

export async function rejectSettlementHold(lineId: string, reason: string): Promise<unknown> {
  const { data } = await api.post(`/settlements/holds/${lineId}/reject`, { reason });
  return data;
}

export interface LocaleDraft {
  locale: string;
  key: string;
  enSource: string;
  draft: string;
  status: string;
}

export async function getLocaleDrafts(
  locale: string,
  cursor?: string,
  limit = 20
): Promise<{ data: LocaleDraft[]; nextCursor: string | null }> {
  const { data } = await api.get<{ data: LocaleDraft[]; nextCursor: string | null }>(
    '/admin/locale-drafts',
    { params: { locale, cursor, limit } }
  );
  return data;
}

export async function decideLocaleApproval(
  locale: string,
  key: string,
  action: 'approve' | 'reject'
): Promise<unknown> {
  const { data } = await api.post('/admin/locale-approvals', { locale, key, action });
  return data;
}

export interface NorthStar {
  weeklyTransactingFarmers: number;
  gmvPerMarketplace: Record<string, number>;
  takeRateRevenuePaisa: number;
  paidPlanConversion: number;
  tasksPerUserPerWeek: number;
  deepLinkCompletionRate: number;
}

export async function getNorthStar(): Promise<NorthStar> {
  const { data } = await api.get<NorthStar>('/analytics/north-star');
  return data;
}
