import { setState } from '../state.js';

export function renderNewsCard(news, colorMap, onEdit, onDelete) {
  const colorVal = colorMap[news.color] || '#F59E0B';
  const date = formatDate(news.created_at);
  const edited = news.updated_at && news.updated_at !== news.created_at;

  const card = document.createElement('article');
  card.className = 'news-card';
  card.style.setProperty('--card-color', colorVal);

  card.innerHTML = `
    <div class="card-border"></div>
    <div class="card-body">
      <div class="card-meta">
        <time class="card-date" title="${formatDateFull(news.created_at)}">${date}</time>
        ${edited ? `<span class="card-edited" title="Изменено: ${formatDateFull(news.updated_at)}">изм.</span>` : ''}
        <div class="card-actions">
          <button class="btn-icon-sm" data-action="edit" title="Редактировать">✎</button>
          <button class="btn-icon-sm danger" data-action="delete" title="Удалить">✕</button>
        </div>
      </div>

      <p class="card-desc">${escHtml(news.description)}</p>

      ${news.photos && news.photos.length > 0 ? `
        <div class="card-photos">
          ${news.photos.map((p, i) => `
            <button class="photo-thumb-btn" data-src="${p.url}" data-idx="${i}" title="Открыть фото">
              <img src="${p.thumbnail_url}" alt="фото" loading="lazy" class="photo-thumb"/>
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // Actions
  card.querySelector('[data-action="edit"]').addEventListener('click', () => onEdit(news));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => onDelete(news));

  // Lightbox
  const photoUrls = (news.photos || []).map(p => p.url).filter(Boolean);
  card.querySelectorAll('.photo-thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.idx) || 0;
      setState({
        lightboxUrl: btn.dataset.src,
        lightboxPhotos: photoUrls,
        lightboxIndex: index,
      });
    });
  });

  return card;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateFull(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-RU');
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
