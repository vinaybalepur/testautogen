import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // Send cookies with every request
  headers: { 'Content-Type': 'application/json' },
});

// ── Response interceptor — auto-refresh on 401 TOKEN_EXPIRED ──
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any) => {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(null)));
  failedQueue = [];
};

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    const code = err.response?.data?.code;

    // Only refresh once per 401 TOKEN_EXPIRED; avoid refresh-endpoint loops
    if (
      err.response?.status === 401 &&
      code === 'TOKEN_EXPIRED' &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue subsequent requests while refresh is in-flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original)).catch(e => Promise.reject(e));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(original); // Retry original request
      } catch (refreshErr) {
        processQueue(refreshErr);
        // Refresh failed → redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
