import api from './api.js';

export const recordsService = {
  async list() {
    const res = await api.get('/medical-records');
    return res.data.data.records;
  },
  async create(data) {
    const res = await api.post('/medical-records', data);
    return res.data.data.record;
  },
  async update(id, data) {
    const res = await api.patch(`/medical-records/${id}`, data);
    return res.data.data.record;
  },
  async addPrescriptions(id, prescriptions) {
    const res = await api.post(`/medical-records/${id}/prescriptions`, { prescriptions });
    return res.data.data.record;
  },
  async removePrescription(id, prescriptionId) {
    await api.delete(`/medical-records/${id}/prescriptions/${prescriptionId}`);
  },
};
