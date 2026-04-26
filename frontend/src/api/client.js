const BASE = '/api'

export function getToken() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
}

export async function request(method, path, body, isFormData = false) {
  const headers = { Authorization: `Bearer ${getToken()}` }
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const resp = await fetch(BASE + path, {
    method,
    headers,
    body: body && !isFormData ? JSON.stringify(body) : body,
  })

  if (resp.status === 401) {
    document.cookie = 'remembered_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    const err = await resp.json().catch(() => ({}))
    const unauthorized = new Error(err.detail || 'Сессия истекла. Войдите снова.')
    unauthorized.code = 'UNAUTHORIZED'
    throw unauthorized
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail || 'Ошибка запроса')
  }

  if (resp.status === 204) return null
  return resp.json()
}
