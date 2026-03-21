export const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  news: [],
  total: 0,
  page: 1,
  pages: 1,
  colors: [],
  loading: false,
  loadError: null,
  lightboxUrl: null,
  lightboxPhotos: [],
  lightboxIndex: 0,
  publicToken: null,
  publicNewsItem: null,
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
