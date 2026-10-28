import axios from 'axios';
import { awaitPersonaSync } from '../personaSync';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  // Persona-gated endpoints read the server-side active profile; serialize
  // behind any in-flight activation so fetches can't 403 on a stale profile.
  // The activation request itself sets skipPersonaSync (it IS the sync).
  const cfg = config as typeof config & { skipPersonaSync?: boolean };
  if (!cfg.skipPersonaSync) {
    await awaitPersonaSync();
  }
  const token = localStorage.getItem('agrovercity_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // The instance default Content-Type above makes axios's default
  // transformRequest JSON-encode FormData bodies (image:{} → 422 on
  // multipart endpoints). Drop it so the browser sets multipart with a
  // boundary instead. Applies to every direct apiClient FormData call too
  // (uploads, KYC, deal/purchase attachments, disease scans).
  if (config.data instanceof FormData && config.headers) {
    if (typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('agrovercity_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          const newAccess = res.data.accessToken || res.data.access_token;
          if (newAccess) {
            localStorage.setItem('agrovercity_access_token', newAccess);
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return apiClient(originalRequest);
          }
        } catch {
          localStorage.removeItem('agrovercity_access_token');
          localStorage.removeItem('agrovercity_refresh_token');
        }
      }
    }
    return Promise.reject(error);
  }
);
