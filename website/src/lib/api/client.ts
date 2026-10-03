import axios, { AxiosError, AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import { getAppCheckToken } from '../firebase';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import type { ApiErrorBody, RefreshResponse } from './types';

/**
 * HTTP client mirroring apps/mobile/lib/api/api_client.dart:
 * - Authorization: Bearer on all non-public paths
 * - Accept-Language on every request
 * - Idempotency-Key (uuid4) on all writes
 * - 401 -> single-flight refresh -> retry once; refresh failure -> clear session
 * - Error envelope: { error: { code, message, fieldErrors } }
 */

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/v1';

const PUBLIC_PATH_PREFIXES = [
  '/health',
  '/app-config',
  '/languages',
  '/geo',
  '/regions',
  '/auth/login',
  '/auth/firebase-verify',
  '/auth/register',
  '/auth/refresh',
  '/auth/mpin/reset',
  '/auth/quick-login',
];

function isPublicPath(url?: string): boolean {
  if (!url) return false;
  const path = url.startsWith('http') ? new URL(url).pathname.replace(/^\/v1/, '') : url;
  return PUBLIC_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}?`) || path.startsWith(`${p}/`));
}

export class ApiError extends Error {
  code: string;
  status: number;
  fieldErrors?: Record<string, string>;
  constructor(body: ApiErrorBody | undefined, status: number) {
    super(body?.message ?? `Request failed (${status})`);
    this.code = body?.code ?? `HTTP_${status}`;
    this.status = status;
    this.fieldErrors = body?.fieldErrors;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

interface RetryConfig extends AxiosRequestConfig {
  _retried?: boolean;
  headers?: AxiosRequestHeaders & { Authorization?: string };
}

export const api = axios.create({ baseURL, timeout: 20000 });

api.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};
  const lang = useOnboardingStore.getState().language;
  config.headers['Accept-Language'] = lang || 'en';
  if (!isPublicPath(config.url)) {
    const token = useSessionStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) config.headers['X-Firebase-AppCheck'] = appCheckToken;
  if (config.method && config.method !== 'get') {
    config.headers['Idempotency-Key'] = crypto.randomUUID();
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = useSessionStore.getState().refreshToken;
      if (!refreshToken) return null;
      try {
        const { data } = await axios.post<RefreshResponse>(`${baseURL}/auth/refresh`, { refreshToken });
        useSessionStore.getState().setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        useSessionStore.getState().clear();
        if (!window.location.pathname.startsWith('/auth')) {
          window.location.assign('/auth');
        }
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const status = error.response?.status ?? 0;
    const errBody = error.response?.data as { error?: ApiErrorBody } | undefined;

    if (
      status === 401 &&
      config &&
      !config._retried &&
      !isPublicPath(config.url) &&
      config.headers?.Authorization
    ) {
      const newToken = await refreshSession();
      if (newToken) {
        config._retried = true;
        config.headers.Authorization = `Bearer ${newToken}`;
        return api.request(config);
      }
    }
    throw new ApiError(errBody?.error, status);
  }
);
