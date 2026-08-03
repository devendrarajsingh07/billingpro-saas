import api from './api';

const invoiceService = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  remove: (id) => api.delete(`/invoices/${id}`),
  send: (id) => api.post(`/invoices/${id}/send`),
  markPaid: (id, data) => api.post(`/invoices/${id}/mark-paid`, data),
  addPayment: (id, data) => api.post(`/invoices/${id}/payments`, data),
  duplicate: (id) => api.post(`/invoices/${id}/duplicate`),
  generatePdf: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  getStats: () => api.get('/invoices/stats'),
  getRecent: (limit = 5) => api.get('/invoices/recent', { params: { limit } }),
  search: (query) => api.get('/invoices/search', { params: { q: query } }),
};

export default invoiceService;
