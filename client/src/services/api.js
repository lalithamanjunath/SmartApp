import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 12000,
});

export function apiMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.message || (error?.code === 'ECONNABORTED' ? 'The request took too long. Please try again.' : fallback);
}

export const dataOf = (response) => response.data?.data;
