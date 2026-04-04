import { setState } from '/state.js';

export function renderNewsCard(news, colorMap, onEdit, onRotateLink, onDelete, canManage = true) {
  const colorVal = colorMap[news.color] || '#F59E0B';
  const date = formatDate(news.created_at);
  const edited = news.updated_at && news.updated_at !== news.created_at;
  const mediaItems = Array.isArray(news.media) && news.media.length > 0 ? news.media : (news.photos || []);
  const imageIndexByUrl = new Map();
  mediaItems.forEach(item => {
    if ((item.media_kind || 'image') === 'image' && item.url && !imageIndexByUrl.has(item.url)) {
      imageIndexByUrl.set(item.url, imageIndexByUrl.size);
    }
  });

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

      ${mediaItems.length > 0 ? `
        <div class="card-photos">
          ${mediaItems.map((item, i) => renderMediaItem(item, i, imageIndexByUrl)).join('')}
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
  // Lightbox for images
  const imageItems = mediaItems.filter(item => (item.media_kind || 'image') === 'image' && item.url);
  const photoUrls = imageItems.map(item => item.url);
  card.querySelectorAll('.photo-thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const imageIndex = Number(btn.dataset.imageIdx);
      if (!Number.isFinite(imageIndex)) return;
      setState({
        lightboxUrl: btn.dataset.src,
        lightboxPhotos: photoUrls,
        lightboxIndex: imageIndex,
        lightboxType: 'image',
      });
    });
  });
  // Lightbox for videos
  card.querySelectorAll('.video-thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setState({
        lightboxUrl: btn.dataset.src,
        lightboxType: 'video',
        lightboxPoster: btn.dataset.poster || '',
      });
    });
  });

  return card;
}

const _TZ = 'Europe/Madrid';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: _TZ }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: _TZ });
}

function formatDateFull(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-RU', { timeZone: _TZ });
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMediaItem(item, index, imageIndexByUrl) {
  const kind = item.media_kind || 'image';
  if (kind === 'video') {
    const poster = item.thumbnail_url || item.url;
    return `
      <button class="video-thumb-btn" data-src="${item.url}" data-poster="${poster}" title="Открыть видео">
        <span class="video-thumb-overlay"><svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="rgba(0,0,0,0.38)"/><polygon points="13,10 24,16 13,22" fill="#fff"/></svg></span>
        <img src="${poster}" alt="видео превью" loading="lazy" class="video-thumb"/>
      </button>
    `;
  }

  if (kind === 'audio') {
    return `
      <div class="media-audio-wrap" data-idx="${index}">
        <audio src="${item.url}" controls preload="metadata" class="media-audio"></audio>
      </div>
    `;
  }

  const thumb = item.thumbnail_url || item.url;
  const imageIdx = imageIndexByUrl.get(item.url) ?? 0;
  return `
    <button class="photo-thumb-btn" data-src="${item.url}" data-image-idx="${imageIdx}" title="Открыть фото">
      <img src="${thumb}" alt="фото" loading="lazy" class="photo-thumb"/>
    </button>
  `;
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
