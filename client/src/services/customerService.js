import api from './api';

const customerService = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  remove: (id) => api.delete(`/customers/${id}`),
  getInvoices: (id, params) => api.get(`/customers/${id}/invoices`, { params }),
  getStats: (id) => api.get(`/customers/${id}/stats`),
  search: (query) => api.get('/customers/search', { params: { q: query } }),
  exportCsv: () => api.get('/customers/export', { responseType: 'blob' }),
};

export default customerService;
