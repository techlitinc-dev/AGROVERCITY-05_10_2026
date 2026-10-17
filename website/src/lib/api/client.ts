import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('agrovercity_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
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
