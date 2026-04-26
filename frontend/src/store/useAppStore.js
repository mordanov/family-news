import { create } from 'zustand'

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
const cookieToken = typeof document !== 'undefined' ? getCookie('remembered_token') : null
if (!storedToken && cookieToken && typeof localStorage !== 'undefined') {
  localStorage.setItem('token', cookieToken)
}

export const useAppStore = create((set, get) => ({
  token: storedToken || cookieToken || null,
  user: null,
  news: [],
  total: 0,
  page: 1,
  pages: 1,
  colors: [],
  loading: false,
  loadError: null,
  lightboxPhotos: [],
  lightboxIndex: 0,
  editingNews: null,
  showForm: false,
  showUsersManager: false,
  users: [],

  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),
  setColors: (colors) => set({ colors }),
  setLoading: (loading) => set({ loading }),
  setLoadError: (loadError) => set({ loadError }),
  setUsers: (users) => set({ users }),

  setNewsPage: (data) => set({
    news: data.items,
    total: data.total,
    page: data.page,
    pages: data.pages,
    loading: false,
  }),

  openLightbox: (photos, index) => set({ lightboxPhotos: photos, lightboxIndex: index }),
  closeLightbox: () => set({ lightboxPhotos: [], lightboxIndex: 0 }),
  moveLightbox: (step) => set((s) => {
    const count = s.lightboxPhotos.length
    if (!count) return {}
    return { lightboxIndex: (s.lightboxIndex + step + count) % count }
  }),

  openForm: (editingNews = null) => set({ showForm: true, editingNews, showUsersManager: false }),
  closeForm: () => set({ showForm: false, editingNews: null }),
  openUsersManager: () => set({ showUsersManager: true, showForm: false }),
  closeUsersManager: () => set({ showUsersManager: false }),

  logout: () => {
    localStorage.removeItem('token')
    document.cookie = 'remembered_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    set({
      token: null, user: null, news: [], users: [], colors: [],
      showForm: false, showUsersManager: false,
      lightboxPhotos: [], lightboxIndex: 0,
      loading: false, loadError: null,
      total: 0, page: 1, pages: 1,
    })
  },
}))
