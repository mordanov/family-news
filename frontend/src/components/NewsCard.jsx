const TZ = 'Europe/Madrid'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return (
    d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }) +
    ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  )
}

function formatDateFull(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', { timeZone: TZ })
}

export default function NewsCard({ news, colorMap, canManage, onEdit, onDelete, onOpenLightbox }) {
  const colorVal = colorMap[news.color] || '#F59E0B'
  const date = formatDate(news.created_at)
  const edited = news.updated_at && news.updated_at !== news.created_at
  const photos = (news.photos || []).filter((p) => p.url)
  const mediaItems = photos.map((p) => ({ url: p.url, media_kind: p.media_kind || 'image' }))

  return (
    <article className="news-card" style={{ '--card-color': colorVal }}>
      <div className="card-border" />
      <div className="card-body">
        <div className="card-meta">
          <time className="card-date" title={formatDateFull(news.created_at)}>{date}</time>
          {edited && (
            <span className="card-edited" title={`Изменено: ${formatDateFull(news.updated_at)}`}>изм.</span>
          )}
          {canManage && (
            <div className="card-actions">
              <button className="btn-icon-sm" title="Редактировать" onClick={onEdit}>✎</button>
              <button className="btn-icon-sm danger" title="Удалить" onClick={onDelete}>✕</button>
            </div>
          )}
        </div>

        <p className="card-desc">{news.description}</p>

        {photos.length > 0 && (
          <div className="card-photos">
            {photos.map((p, i) => (
              <button
                key={p.id || i}
                className={`photo-thumb-btn${p.media_kind === 'video' ? ' video-thumb-btn' : ''}`}
                title={p.media_kind === 'video' ? 'Открыть видео' : 'Открыть фото'}
                onClick={() => onOpenLightbox(mediaItems, i)}
              >
                {p.media_kind === 'video'
                  ? (p.thumbnail_url && p.thumbnail_url !== p.url
                      ? <img src={p.thumbnail_url} alt="видео" loading="lazy" className="photo-thumb" />
                      : <div className="photo-thumb photo-thumb-placeholder" />)
                  : <img src={p.thumbnail_url} alt="фото" loading="lazy" className="photo-thumb" />
                }
                {p.media_kind === 'video' && <span className="video-play-icon">▶</span>}
              </button>
            ))}
          </div>
        )}

        {news.author && (
          <div className="card-author">Автор: {news.author}</div>
        )}
      </div>
    </article>
  )
}
