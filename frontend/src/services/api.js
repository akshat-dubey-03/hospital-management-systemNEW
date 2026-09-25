// src/services/api.js
// Axios instance with request/response interceptors.
// Automatically attaches Authorization header from AuthContext.
// Handles 401 responses by attempting token refresh.

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send HTTP-only cookie for refresh token
  headers: {
    'Content-Type': 'application/json',
  },
});

// Access token is injected via the request interceptor from AuthContext
// This is set up in App.jsx using api.setAccessToken()
let _accessToken = null;

export function setApiAccessToken(token) {
  _accessToken = token;
}

api.interceptors.request.use((config) => {
  if (_accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// Track whether a refresh is in progress to avoid infinite loops
let isRefreshing = false;
let pendingRequests = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying, attempt token refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh') &&
      !originalRequest.url.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await api.post('/auth/refresh');
        const newToken = res.data.data.accessToken;
        setApiAccessToken(newToken);

        // Replay queued requests with new token
        pendingRequests.forEach(({ resolve }) => resolve(newToken));
        pendingRequests = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        pendingRequests.forEach(({ reject }) => reject(refreshError));
        pendingRequests = [];
        // Redirect to login on failed refresh
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
