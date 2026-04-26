import { useEffect, useRef } from 'react'
import { useAppStore } from './store/useAppStore.js'
import { api } from './api/index.js'
import LoginPage from './pages/LoginPage.jsx'
import FeedPage from './pages/FeedPage.jsx'

export default function App() {
  const token = useAppStore((s) => s.token)
  const user = useAppStore((s) => s.user)
  const loading = useAppStore((s) => s.loading)
  const setUser = useAppStore((s) => s.setUser)
  const setColors = useAppStore((s) => s.setColors)
  const setLoading = useAppStore((s) => s.setLoading)
  const setLoadError = useAppStore((s) => s.setLoadError)
  const logout = useAppStore((s) => s.logout)
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (!token) {
      bootstrapped.current = false
      return
    }
    if (bootstrapped.current) return

    const run = async () => {
      setLoading(true)
      try {
        const [me, colors] = await Promise.all([api.me(), api.getColors()])
        setUser(me)
        setColors(colors)
        bootstrapped.current = true
      } catch (e) {
        if (e?.code === 'UNAUTHORIZED') {
          logout()
          return
        }
        setLoadError(e?.message || 'Не удалось загрузить данные.')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [token])

  if (!token) return <LoginPage />

  if (loading && !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
        Загрузка…
      </div>
    )
  }

  return <FeedPage />
}
