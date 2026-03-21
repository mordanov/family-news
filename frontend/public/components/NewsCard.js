import { setState } from '/state.js';

export function renderNewsCard(news, colorMap, onEdit, onRotateLink, onDelete, canManage = true) {
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
        ${news.is_published && news.public_token ? `
          <button class="btn-icon-sm shared" data-action="share" title="Скопировать публичную ссылку" aria-label="Скопировать публичную ссылку">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
        ` : ''}
        ${canManage ? `
        <div class="card-actions">
          ${news.is_published && news.public_token ? '<button class="btn-icon-sm" data-action="rotate-link" title="Обновить ссылку">↻</button>' : ''}
          <button class="btn-icon-sm" data-action="edit" title="Редактировать">✎</button>
          <button class="btn-icon-sm danger" data-action="delete" title="Удалить">✕</button>
        </div>
        ` : ''}
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

      ${news.author ? `<div class="card-author">Автор: ${escHtml(news.author)}</div>` : ''}
    </div>
  `;

  // Actions
  if (canManage) {
    card.querySelector('[data-action="rotate-link"]')?.addEventListener('click', () => onRotateLink(news));
    card.querySelector('[data-action="edit"]').addEventListener('click', () => onEdit(news));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => onDelete(news));
  }

  const shareBtn = card.querySelector('[data-action="share"]');
  if (shareBtn && news.public_token) {
    shareBtn.addEventListener('click', async () => {
      const shareUrl = `${window.location.origin}/public/news/${encodeURIComponent(news.public_token)}`;
      await copyToClipboard(shareUrl);
      shareBtn.classList.add('copied');
      shareBtn.title = 'Ссылка скопирована';
      setTimeout(() => {
        shareBtn.classList.remove('copied');
        shareBtn.title = 'Скопировать публичную ссылку';
      }, 1300);
    });
  }

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

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.setAttribute('readonly', '');
  temp.style.position = 'absolute';
  temp.style.left = '-9999px';
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  temp.remove();
}

