import api from './api'

export const search = (q) => api.get('/api/v1/search', { params: { q } })
