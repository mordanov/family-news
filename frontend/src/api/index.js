import { request } from './client.js'

export const api = {
  async login(login, password, rememberMe = false) {
    const form = new URLSearchParams()
    form.append('username', login)
    form.append('password', password)
    form.append('remember_me', rememberMe ? 'true' : 'false')
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.detail || 'Неверный логин или пароль')
    }
    return resp.json()
  },

  me: () => request('GET', '/auth/me'),
  getColors: () => request('GET', '/news/meta/colors'),
  getNews: (page = 1) => request('GET', `/news?page=${page}&per_page=10`),

  async createNewsDraft(payload) {
    const fd = new FormData()
    fd.append('description', payload.description)
    fd.append('color', payload.color)
    if (payload.created_at) fd.append('created_at', payload.created_at)
    fd.append('is_published', String(!!payload.is_published))
    return request('POST', '/news', fd, true)
  },

  uploadNewsMedia(newsId, file) {
    const fd = new FormData()
    fd.append('media_file', file)
    return request('POST', `/news/${newsId}/media`, fd, true)
  },

  updateNews(id, formData) {
    return request('PUT', `/news/${id}`, formData, true)
  },

  deleteNews: (id) => request('DELETE', `/news/${id}`),
  deletePhoto: (newsId, photoId) => request('DELETE', `/news/${newsId}/photos/${photoId}`),
  getUsers: () => request('GET', '/users'),
  createUser: (payload) => request('POST', '/users', payload),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
  updateUserRole: (id, role) => request('PATCH', `/users/${id}/role`, { role }),
}
