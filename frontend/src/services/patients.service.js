import api from './api.js';

export const patientsService = {
  // Patient self-service
  async me() {
    const res = await api.get('/patients/me');
    return res.data.data.patient;
  },
  async updateMe(data) {
    const res = await api.patch('/patients/me', data);
    return res.data.data.patient;
  },
  // Doctor: own patients
  async listForDoctor(params = {}) {
    const res = await api.get('/patients', { params });
    return res.data.data.patients;
  },
  async getForDoctor(id) {
    const res = await api.get(`/patients/${id}`);
    return res.data.data.patient;
  },
};
