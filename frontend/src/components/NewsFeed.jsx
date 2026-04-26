import { useAppStore } from '../store/useAppStore.js'
import { api } from '../api/index.js'
import NewsCard from './NewsCard.jsx'

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (current > 3) pages.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

export default function NewsFeed({ onLoadPage }) {
  const news = useAppStore((s) => s.news)
  const loading = useAppStore((s) => s.loading)
  const page = useAppStore((s) => s.page)
  const pages = useAppStore((s) => s.pages)
  const user = useAppStore((s) => s.user)
  const colors = useAppStore((s) => s.colors)
  const setNewsPage = useAppStore((s) => s.setNewsPage)
  const setLoading = useAppStore((s) => s.setLoading)
  const openForm = useAppStore((s) => s.openForm)
  const openLightbox = useAppStore((s) => s.openLightbox)
  const canManage = user?.role === 'full_access'

  const colorMap = Object.fromEntries((colors || []).map((c) => [c.id, c.value]))

  const handleDelete = async (item) => {
    if (!canManage) return
    if (!confirm(`Удалить новость?\n\n«${item.description.slice(0, 60)}…»`)) return
    try {
      await api.deleteNews(item.id)
      const data = await api.getNews(page)
      setNewsPage(data)
    } catch (e) {
      alert('Ошибка удаления: ' + e.message)
    }
  }

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
      </div>
    )
  }

  if (!news.length) {
    return (
      <div className="empty-state">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="30" stroke="#006D5B" strokeWidth="2" opacity="0.3"/>
          <path d="M20 32h24M32 20v24" stroke="#006D5B" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
        </svg>
        <p dangerouslySetInnerHTML={{ __html: canManage
          ? 'Новостей пока нет.<br>Нажмите «Добавить», чтобы создать первую!'
          : 'Новостей пока нет.'
        }} />
      </div>
    )
  }

  const range = pageRange(page, pages)

  return (
    <div>
      <div className="feed">
        {news.map((item) => (
          <NewsCard
            key={item.id}
            news={item}
            colorMap={colorMap}
            canManage={canManage}
            onEdit={() => openForm(item)}
            onDelete={() => handleDelete(item)}
            onOpenLightbox={(photos, idx) => openLightbox(photos, idx)}
          />
        ))}
      </div>
      {pages > 1 && (
        <div className="pagination">
          <button
            className={`page-btn ${page <= 1 ? 'disabled' : ''}`}
            disabled={page <= 1}
            onClick={() => onLoadPage(page - 1)}
          >‹ Назад</button>
          {range.map((p, i) =>
            p === '…'
              ? <span key={`ell-${i}`} className="page-ellipsis">…</span>
              : <button
                  key={p}
                  className={`page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => onLoadPage(p)}
                >{p}</button>
          )}
          <button
            className={`page-btn ${page >= pages ? 'disabled' : ''}`}
            disabled={page >= pages}
            onClick={() => onLoadPage(page + 1)}
          >Вперёд ›</button>
        </div>
      )}
    </div>
  )
}
