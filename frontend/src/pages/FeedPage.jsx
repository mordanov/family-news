import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { api } from '../api/index.js'
import Header from '../components/Header.jsx'
import NewsFeed from '../components/NewsFeed.jsx'
import NewsForm from '../components/NewsForm.jsx'
import UsersManager from '../components/UsersManager.jsx'
import Lightbox from '../components/Lightbox.jsx'

export default function FeedPage() {
  const page = useAppStore((s) => s.page)
  const showForm = useAppStore((s) => s.showForm)
  const showUsersManager = useAppStore((s) => s.showUsersManager)
  const lightboxPhotos = useAppStore((s) => s.lightboxPhotos)
  const setNewsPage = useAppStore((s) => s.setNewsPage)
  const setLoading = useAppStore((s) => s.setLoading)
  const loadPage = async (p) => {
    setLoading(true)
    try {
      const data = await api.getNews(p)
      setNewsPage(data)
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPage(1)
  }, [])

  return (
    <>
      <Header onLoadPage={loadPage} />
      <main className="app-main">
        <div className="feed-container">
          <NewsFeed onLoadPage={loadPage} />
        </div>
      </main>
      {showForm && <NewsForm onSaved={() => loadPage(page)} />}
      {showUsersManager && <UsersManager />}
      {lightboxPhotos.length > 0 && <Lightbox />}
    </>
  )
}
