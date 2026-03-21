import { api } from '/api.js';
import { state, setState } from '/state.js';
import { renderNewsCard } from './NewsCard.js';

export function renderFeed(container, colorMap) {
  if (state.loading) {
    container.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    return;
  }

  if (state.loadError && !state.news.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="30" stroke="#C2410C" stroke-width="2" opacity="0.25"/>
          <path d="M32 18v18" stroke="#C2410C" stroke-width="3" stroke-linecap="round"/>
          <circle cx="32" cy="45" r="2.5" fill="#C2410C"/>
        </svg>
        <p>Не удалось загрузить новости.<br>${state.loadError}</p>
        <button id="retry-feed-load" class="btn-primary" type="button">Повторить</button>
      </div>`;
    document.getElementById('retry-feed-load')?.addEventListener('click', () => {
      loadPage(state.page || 1);
    });
    return;
  }

  if (!state.news.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="30" stroke="#006D5B" stroke-width="2" opacity="0.3"/>
          <path d="M20 32h24M32 20v24" stroke="#006D5B" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        </svg>
        <p>Новостей пока нет.<br>Нажмите «Добавить», чтобы создать первую!</p>
      </div>`;
    return;
  }

  const feed = document.createElement('div');
  feed.className = 'feed';

  state.news.forEach(news => {
    const card = renderNewsCard(
      news,
      colorMap,
      (n) => setState({ editingNews: n, showForm: true }),
      async (n) => {
        if (!confirm(`Удалить новость?\n\n«${n.description.slice(0, 60)}…»`)) return;
        try {
          await api.deleteNews(n.id);
          await loadPage(state.page);
        } catch (e) {
          alert('Ошибка удаления: ' + e.message);
        }
      }
    );
    feed.appendChild(card);
  });

  // Pagination
  if (state.pages > 1) {
    const pager = document.createElement('div');
    pager.className = 'pagination';
    pager.innerHTML = buildPager(state.page, state.pages);
    pager.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => loadPage(parseInt(btn.dataset.page)));
    });
    feed.appendChild(pager);
  }

  container.innerHTML = '';
  container.appendChild(feed);
}

export async function loadPage(page) {
  setState({ loading: true, loadError: null });
  try {
    const data = await api.getNews(page);
    setState({
      news: data.items,
      total: data.total,
      page: data.page,
      pages: data.pages,
      loadError: null,
      loading: false,
    });
  } catch (e) {
    setState({ loading: false, loadError: e.message || 'Попробуйте обновить страницу чуть позже.' });
    console.error(e);
  }
}

function buildPager(current, total) {
  let html = '';
  const prev = current > 1;
  const next = current < total;

  html += `<button class="page-btn ${!prev ? 'disabled' : ''}" data-page="${current - 1}" ${!prev ? 'disabled' : ''}>‹ Назад</button>`;

  // Page numbers
  const range = pageRange(current, total);
  range.forEach(p => {
    if (p === '…') {
      html += `<span class="page-ellipsis">…</span>`;
    } else {
      html += `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
  });

  html += `<button class="page-btn ${!next ? 'disabled' : ''}" data-page="${current + 1}" ${!next ? 'disabled' : ''}>Вперёд ›</button>`;
  return html;
}

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
