import { api } from './client';

/**
 * Admin API wrappers. Phase-06 shipped the plain queue pages; phase-07 adds the
 * full console. Every mutation attaches `X-Admin-Role` + `X-Audit-Reason`.
 */

export function mutationHeaders(role: string, reason: string): Record<string, string> {
  return { 'X-Admin-Role': role, 'X-Audit-Reason': reason };
}

export interface AdminOverview {
  activeUsersTotal: number;
  personaBreakdown: Record<string, number>;
  marketplaceGMV: number;
  pendingClaimsCount: number;
  pendingSettlementsAmount: number;
  pendingKycCount?: number;
  activeFarmlandLeases?: number;
  platformHealth?: string;
  timestamp?: string;
}

export async function getOverview(): Promise<AdminOverview> {
  const { data } = await api.get<AdminOverview>('/admin/overview');
  return data;
}

export interface AdminUser {
  id: string;
  name?: string;
  phone?: string;
  status?: string;
  linkedProfiles?: string[];
  [key: string]: unknown;
}

export async function listUsers(params: {
  persona?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ data: AdminUser[]; total: number; page: number; pageSize: number }> {
  const { data } = await api.get('/admin/users', { params });
  return data;
}

export async function setUserStatus(
  uid: string,
  status: string,
  reason: string,
  role: string
): Promise<unknown> {
  const { data } = await api.post(
    `/admin/users/${uid}/status`,
    { status, reason },
    { headers: mutationHeaders(role, reason) }
  );
  return data;
}

export interface AuditEntry {
  id: string;
  adminId?: string;
  adminEmail?: string;
  module?: string;
  action?: string;
  targetId?: string;
  previousState?: unknown;
  newState?: unknown;
  reason?: string;
  timestamp?: string;
  ipAddress?: string;
}

export async function getAudit(params: {
  targetId?: string;
  module?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ data: AuditEntry[]; total: number; page: number; pageSize: number }> {
  const { data } = await api.get('/admin/audit', { params });
  return data;
}

export async function verifyMpin(mpin: string): Promise<{ ok: boolean }> {
  const { data } = await api.post('/admin/verify-mpin', { mpin });
  return data;
}

// Generic console helpers — pages compose these with the shared grid/drawer.
export async function adminGet<T = unknown>(
  url: string,
  params?: Record<string, unknown>
): Promise<T> {
  const { data } = await api.get<T>(url, { params });
  return data;
}

export async function adminPost<T = unknown>(
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const { data } = await api.post<T>(url, body ?? {}, { headers });
  return data;
}

export async function adminPut<T = unknown>(
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const { data } = await api.put<T>(url, body ?? {}, { headers });
  return data;
}

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
