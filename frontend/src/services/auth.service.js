// src/services/auth.service.js
// Frontend authentication API calls.

import api from './api.js';

export const authService = {
  async register(data) {
    const res = await api.post('/auth/register', data);
    return res.data.data;
  },

  async login(credentials) {
    const res = await api.post('/auth/login', credentials);
    return res.data.data; // { accessToken, user }
  },

  async refresh() {
    const res = await api.post('/auth/refresh');
    return res.data.data; // { accessToken }
  },

  async logout(accessToken) {
    await api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  async getMe(accessToken) {
    const res = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data.data.user;
  },
};
