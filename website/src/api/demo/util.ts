import { settings } from '@/config/settings';
import type { Page, ProfileType } from '@/api/types';
import { getDb } from './db';

export class DemoHttpError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, unknown>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function demoError(
  status: number,
  code: string,
  message: string,
  fieldErrors: Record<string, unknown> = {},
): DemoHttpError {
  return new DemoHttpError(status, code, message, fieldErrors);
}

export function latency(): Promise<void> {
  const jitter = Math.random() * settings.demoLatencyMs * 0.4;
  return new Promise((resolve) => setTimeout(resolve, settings.demoLatencyMs + jitter));
}

export function paginate<T>(list: T[], query: Record<string, string>): Page<T> {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 20) || 20));
  const start = (page - 1) * pageSize;
  return { data: list.slice(start, start + pageSize), page, pageSize, total: list.length };
}

const counters = new Map<string, number>();

export function id(prefix: string): string {
  const n = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, n);
  return `${prefix}_${n.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const idemCache = new Map<string, { status: number; body: unknown }>();

export function idemGet(key: string) {
  return idemCache.get(key);
}

export function idemSet(key: string, status: number, body: unknown): void {
  idemCache.set(key, { status, body });
}

export interface AuthedUser {
  uid: string;
  activeProfile: ProfileType;
}

export function requireAuth(headers: Record<string, string>): AuthedUser {
  const auth = headers['authorization'] ?? headers['Authorization'];
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw demoError(401, 'TOKEN_MISSING', 'प्रमाणीकरण आवश्यक है। कृपया लॉगिन करें।');
  const m = /^demo-(.+)-(\d+)$/.exec(token);
  const db = getDb();
  const uid = m?.[1];
  if (!uid || !db.users[uid]) {
    throw demoError(401, 'TOKEN_INVALID', 'सत्र अमान्य है। कृपया फिर लॉगिन करें।');
  }
  return { uid, activeProfile: db.users[uid].activeProfile };
}

export function requireRole(user: AuthedUser, roles: ProfileType[]): void {
  if (!roles.includes(user.activeProfile)) {
    throw demoError(403, 'FORBIDDEN_ROLE', 'यह सुविधा आपकी प्रोफ़ाइल के लिए उपलब्ध नहीं है।');
  }
}
