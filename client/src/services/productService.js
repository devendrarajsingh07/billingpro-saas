import api from './api';

const productService = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  remove: (id) => api.delete(`/products/${id}`),
  getLowStock: () => api.get('/products/low-stock'),
  updateStock: (id, quantity) => api.patch(`/products/${id}/stock`, { quantity }),
  getCategories: () => api.get('/products/categories'),
  search: (query) => api.get('/products/search', { params: { q: query } }),
};

export default productService;
