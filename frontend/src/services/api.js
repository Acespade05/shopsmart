import axios from 'axios';

// In production (served via nginx), the frontend and API share the same
// origin, so a relative path works regardless of domain/IP. In local dev,
// Vite's dev server runs on a different port than the backend, so we point
// directly at localhost:3000.
const baseURL = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;