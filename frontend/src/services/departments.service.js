import api from './api.js';

export const departmentsService = {
  async list() {
    const res = await api.get('/departments');
    return res.data.data.departments;
  },
  async create(data) {
    const res = await api.post('/departments', data);
    return res.data.data.department;
  },
  async update(id, data) {
    const res = await api.patch(`/departments/${id}`, data);
    return res.data.data.department;
  },
  async remove(id) {
    await api.delete(`/departments/${id}`);
  },
};
