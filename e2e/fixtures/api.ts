/**
 * Direct backend API helpers (node side, used for setup / assertions / admin
 * actions). The UI under test still goes through the website; these calls only
 * replace what a second tester or admin would do, per the manual script's
 * "[ADMIN]"/"🔄" markings, plus fast deterministic login.
 */
import { API_BASE, FARMER, ADMIN } from '../test-data';

export interface ApiResult {
  status: number;
  body: any;
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; params?: Record<string, string> } = {}
): Promise<ApiResult> {
  const url = new URL(`${API_BASE}${path}`);
  if (opts.params) Object.entries(opts.params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  let body: any = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

export const api = {
  get: (p: string, token?: string, params?: Record<string, string>) => call('GET', p, { token, params }),
  post: (p: string, body?: unknown, token?: string) => call('POST', p, { body, token }),
  put: (p: string, body?: unknown, token?: string) => call('PUT', p, { body, token }),
  patch: (p: string, body?: unknown, token?: string) => call('PATCH', p, { body, token }),
  del: (p: string, token?: string) => call('DELETE', p, { token }),
};

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: any;
}

export async function loginWithMpin(phone: string, mpin: string): Promise<Session> {
  const { status, body } = await api.post('/auth/login', { phone, mpin });
  if (status !== 200 || !body?.accessToken) {
    throw new Error(`MPIN login failed (${status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  return { accessToken: body.accessToken, refreshToken: body.refreshToken, user: body.user };
}

export async function loginFarmer(): Promise<Session> {
  return loginWithMpin(FARMER.phone, FARMER.mpin);
}

export async function loginAdmin(): Promise<Session> {
  return loginWithMpin(ADMIN.phone, ADMIN.mpin);
}

/** Dev OTP flow: request → returns devOtp straight from the API response. */
export async function requestOtp(phone: string): Promise<{ otpSessionId?: string; devOtp?: string }> {
  const { status, body } = await api.post('/auth/otp/send', { phone });
  if (status !== 200) throw new Error(`otp/send failed (${status}): ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

export async function verifyOtp(phone: string, otp: string, otpSessionId?: string): Promise<ApiResult> {
  return api.post('/auth/otp/verify', { phone, otp, ...(otpSessionId ? { otpSessionId } : {}) });
}

/** [ADMIN] Approve every pending KYC case for a user (farmer persona). */
export async function adminApproveKyc(admin: Session, uid: string): Promise<void> {
  const { body } = await api.get('/admin/kyc/pending', admin.accessToken);
  const cases = Array.isArray(body) ? body : (body?.data ?? body?.items ?? []);
  for (const kycCase of cases) {
    const caseUid = kycCase.userId ?? kycCase.uid;
    if (caseUid !== uid) continue;
    const docs = kycCase.docs ?? [];
    for (const doc of docs) {
      if (doc.status === 'pending' || doc.status === 'in_review') {
        await api.post(`/admin/kyc/${doc.docId}/verify`, { reason: 'UAT auto-approve' }, admin.accessToken);
      }
    }
  }
}

/** [ADMIN] Approve/reject a produce lot pending moderation. */
export async function adminModerateLot(
  admin: Session,
  lotId: string,
  action: 'approve' | 'reject',
  reason?: string
): Promise<ApiResult> {
  return api.post(`/admin/moderation/${lotId}/action`, { action, reason }, admin.accessToken);
}

export async function healthCheck(): Promise<boolean> {
  try {
    const { status } = await api.get('/health');
    return status === 200;
  } catch {
    return false;
  }
}
