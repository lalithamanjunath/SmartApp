import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 12000,
});

let csrfToken = '';
api.interceptors.request.use((config) => {
  if (csrfToken && !['get', 'head', 'options'].includes(String(config.method || 'get').toLowerCase())) {
    config.headers.set('X-CSRF-Token', csrfToken);
  }
  return config;
});
api.interceptors.response.use((response) => {
  if (response.config.url?.endsWith('/auth/csrf')) csrfToken = response.data?.data?.csrfToken || '';
  return response;
});

export function apiMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.message || (error?.code === 'ECONNABORTED' ? 'The request took too long. Please try again.' : fallback);
}

export const dataOf = (response) => response.data?.data;
