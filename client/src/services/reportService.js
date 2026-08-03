import api from './api';

const reportService = {
  getDashboardStats: () => api.get('/reports/dashboard'),
  getRevenueChart: (params) => api.get('/reports/revenue', { params }),
  getInvoiceStatusChart: () => api.get('/reports/invoice-status'),
  getTopCustomers: (params) => api.get('/reports/top-customers', { params }),
  getMonthlySales: (params) => api.get('/reports/monthly-sales', { params }),
  getExpenses: (params) => api.get('/reports/expenses', { params }),
  getPayments: (params) => api.get('/reports/payments', { params }),
  getProfitLoss: (params) => api.get('/reports/profit-loss', { params }),
  exportReport: (type, params) => api.get(`/reports/export/${type}`, { params, responseType: 'blob' }),
};

export default reportService;
