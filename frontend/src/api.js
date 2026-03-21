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
  async login(login, password) {
    const form = new URLSearchParams();
    form.append('username', login);
    form.append('password', password);
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

  async updateNews(id, formData) {
    return request('PUT', `/news/${id}`, formData, true);
  },

  async deleteNews(id) {
    return request('DELETE', `/news/${id}`);
  },

  async deletePhoto(newsId, photoId) {
    return request('DELETE', `/news/${newsId}/photos/${photoId}`);
  },
};
