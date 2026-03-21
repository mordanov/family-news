const BASE = '/api';
const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function canRetry(method, status) {
  return RETRYABLE_METHODS.has(method) && RETRYABLE_STATUSES.has(status);
}

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

async function request(method, path, body, isFormData = false) {
  const headers = authHeaders();
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const retryCount = RETRYABLE_METHODS.has(method) ? RETRY_DELAYS_MS.length : 0;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    let resp;

    try {
      resp = await fetch(BASE + path, {
        method,
        headers,
        body: body && !isFormData ? JSON.stringify(body) : body,
        cache: 'no-store',
      });
    } catch (error) {
      if (attempt < retryCount) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error('Сервер временно недоступен. Попробуйте ещё раз через несколько секунд.');
    }

    if (resp.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
      return;
    }

    if (canRetry(method, resp.status) && attempt < retryCount) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || 'Ошибка запроса');
    }

    if (resp.status === 204) return null;
    return resp.json();
  }
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
