import api from './api.js';

export const billsService = {
  async list(params = {}) {
    const res = await api.get('/bills', { params });
    return res.data.data.bills;
  },
  async unbilled() {
    const res = await api.get('/bills/unbilled');
    return res.data.data.appointments;
  },
  async create(data) {
    const res = await api.post('/bills', data);
    return res.data.data.bill;
  },
  async update(id, data) {
    const res = await api.patch(`/bills/${id}`, data);
    return res.data.data.bill;
  },
};
