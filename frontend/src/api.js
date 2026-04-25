const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

async function request(method, path, body, isFormData = false) {
  const headers = authHeaders();
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const resp = await fetch(BASE + path, {
    method,
    headers,
    body: body && !isFormData ? JSON.stringify(body) : body,
  });

  if (resp.status === 401) {
    document.cookie = 'remembered_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    const err = await resp.json().catch(() => ({}));
    const unauthorized = new Error(err.detail || 'Сессия истекла. Войдите снова.');
    unauthorized.code = 'UNAUTHORIZED';
    throw unauthorized;
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Ошибка запроса');
  }

  if (resp.status === 204) return null;
  return resp.json();
}

export const api = {
  async login(login, password, rememberMe = false) {
    const form = new URLSearchParams();
    form.append('username', login);
    form.append('password', password);
    form.append('remember_me', rememberMe ? 'true' : 'false');
    const resp = await fetch(BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || 'Неверный логин или пароль');
    }
    return resp.json();
  },

  async me() {
    return request('GET', '/auth/me');
  },

  async getColors() {
    return request('GET', '/news/meta/colors');
  },

  async getNews(page = 1) {
    return request('GET', `/news?page=${page}&per_page=10`);
  },

  async createNews(formData) {
    return request('POST', '/news', formData, true);
  },

  async createNewsDraft(payload) {
    const fd = new FormData();
    fd.append('description', payload.description);
    fd.append('color', payload.color);
    if (payload.created_at) fd.append('created_at', payload.created_at);
    fd.append('is_published', String(!!payload.is_published));
    return request('POST', '/news', fd, true);
  },

  async uploadNewsMedia(newsId, file) {
    const fd = new FormData();
    fd.append('media_file', file);
    return request('POST', `/news/${newsId}/media`, fd, true);
  },

  async updateNews(id, formData) {
    return request('PUT', `/news/${id}`, formData, true);
  },

  async deleteNews(id) {
    return request('DELETE', `/news/${id}`);
  },

  async deletePhoto(newsId, photoId) {
    return request('DELETE', `/news/${newsId}/photos/${photoId}`);
  },

  async getUsers() {
    return request('GET', '/users');
  },

  async createUser(payload) {
    return request('POST', '/users', payload);
  },

  async deleteUser(id) {
    return request('DELETE', `/users/${id}`);
  },

  async updateUserRole(id, role) {
    return request('PATCH', `/users/${id}/role`, { role });
  },
};
