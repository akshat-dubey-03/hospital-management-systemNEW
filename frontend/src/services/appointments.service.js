import api from './api.js';

export const appointmentsService = {
  async list() {
    const res = await api.get('/appointments');
    return res.data.data.appointments;
  },

  async get(id) {
    const res = await api.get(`/appointments/${id}`);
    return res.data.data.appointment;
  },

  async book(data) {
    const res = await api.post('/appointments', data);
    return res.data.data.appointment;
  },

  async cancel(id, cancellationReason = '') {
    const res = await api.post(`/appointments/${id}/cancel`, { cancellationReason });
    return res.data.data.appointment;
  },

  // Returns { appointment, billGenerated, billPendingAmount } and the server message.
  async updateStatus(id, data) {
    const res = await api.patch(`/appointments/${id}/status`, data);
    return { ...res.data.data, message: res.data.message };
  },
};
