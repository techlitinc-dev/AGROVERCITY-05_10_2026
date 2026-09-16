import { settings } from '@/config/settings';
import { http } from './http';
import { demoFetch, type DemoFetchOpts } from './demo';

export { EP } from './endpoints';
export { ApiError, isApiError } from './errors';
export { getTokens, setTokens, clearTokens } from './http';
export * from './types';

type Opts = DemoFetchOpts;

function dispatch<T>(method: string, path: string, body?: unknown, opts?: Opts): Promise<T> {
  if (settings.apiMode === 'demo') {
    return demoFetch<T>(method, path, { ...opts, body });
  }
  switch (method) {
    case 'GET':
      return http.get<T>(path, opts);
    case 'POST':
      return http.post<T>(path, body, opts);
    case 'PUT':
      return http.put<T>(path, body, opts);
    case 'PATCH':
      return http.patch<T>(path, body, opts);
    default:
      return http.del<T>(path, opts);
  }
}

export const api = {
  get: <T>(path: string, opts?: Opts) => dispatch<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: Opts) => dispatch<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: Opts) => dispatch<T>('PUT', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: Opts) => dispatch<T>('PATCH', path, body, opts),
  del: <T>(path: string, opts?: Opts) => dispatch<T>('DELETE', path, undefined, opts),
  upload: <T>(path: string, formData: FormData, opts?: Opts) => {
    if (settings.apiMode === 'demo') return demoFetch<T>('POST', path, { ...opts, body: formData });
    return http.upload<T>(path, formData, opts);
  },
};
