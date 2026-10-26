import api from './api.js';

export const adminService = {
  // Doctors
  async listDoctors() {
    const res = await api.get('/admin/doctors');
    return res.data.data.doctors;
  },
  async createDoctor(data) {
    const res = await api.post('/admin/doctors', data);
    return res.data.data.doctor;
  },
  async updateDoctor(id, data) {
    const res = await api.patch(`/admin/doctors/${id}`, data);
    return res.data.data.doctor;
  },
  async replaceAvailability(id, availability) {
    const res = await api.put(`/admin/doctors/${id}/availability`, { availability });
    return res.data.data.doctor;
  },
  async deleteDoctor(id) {
    await api.delete(`/admin/doctors/${id}`);
  },
  // Patients
  async listPatients(params = {}) {
    const res = await api.get('/admin/patients', { params });
    return res.data.data.patients;
  },
  async getPatient(id) {
    const res = await api.get(`/admin/patients/${id}`);
    return res.data.data.patient;
  },
  async updatePatient(id, data) {
    const res = await api.patch(`/admin/patients/${id}`, data);
    return res.data.data.patient;
  },
  async deletePatient(id) {
    await api.delete(`/admin/patients/${id}`);
  },
};
