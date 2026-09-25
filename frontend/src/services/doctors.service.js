import api from './api.js';

export const doctorsService = {
  async list(params = {}) {
    const res = await api.get('/doctors', { params });
    return res.data.data.doctors;
  },

  async get(id) {
    const res = await api.get(`/doctors/${id}`);
    return res.data.data.doctor;
  },

  async availability(id, date) {
    const res = await api.get(`/doctors/${id}/availability`, { params: { date } });
    return res.data.data;
  },
};
