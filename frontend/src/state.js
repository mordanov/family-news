const _getCookie = (name) => {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}
const _storedToken = localStorage.getItem('token')
const _cookieToken = _getCookie('remembered_token')
if (!_storedToken && _cookieToken) localStorage.setItem('token', _cookieToken)

export const state = {
  token: _storedToken || _cookieToken || null,
  user: null,
  news: [],
  total: 0,
  page: 1,
  pages: 1,
  colors: [],
  loading: false,
  lightboxUrl: null,
  lightboxPhotos: [],
  lightboxIndex: 0,
  editingNews: null,   // news object being edited
  showForm: false,
  showUsersManager: false,
  users: [],
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  listeners.forEach(fn => fn(state));
}
