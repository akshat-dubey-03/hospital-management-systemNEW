import api from './api.js';

export const dashboardService = {
  async getPatientDashboard() {
    const res = await api.get('/dashboard/patient');
    return res.data.data;
  },

  async getDoctorDashboard() {
    const res = await api.get('/dashboard/doctor');
    return res.data.data;
  },

  async getAdminStats() {
    const res = await api.get('/admin/stats');
    return res.data.data;
  },
};
