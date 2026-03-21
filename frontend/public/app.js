import { api } from '/api.js';
import { state, setState, subscribe } from '/state.js';
import { renderLogin } from '/components/Login.js';
import { renderFeed, loadPage } from '/components/Feed.js';
import { renderNewsCard } from '/components/NewsCard.js';
import { renderNewsForm } from '/components/NewsForm.js';
import { renderLightbox } from '/components/Lightbox.js';
import { renderUsersManager } from '/components/UsersManager.js';

const appEl = document.getElementById('app');
const formEl = document.getElementById('form-mount');
const lbEl = document.getElementById('lightbox-mount');
const PUBLIC_NEWS_PATH_PREFIX = '/public/news/';

let colorMap = {};
let bootstrapPromise = null;

async function bootstrapAuthenticatedState() {
  if (!state.token) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const me = await api.me();
      const colors = await api.getColors();
      colorMap = Object.fromEntries(colors.map(c => [c.id, c.value]));
      setState({ user: me, colors });
      await loadPage(1);
    } catch {
      localStorage.removeItem('token');
      colorMap = {};
      setState({ token: null, user: null, news: [] });
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

async function loadUsersForManager() {
  if (state.user?.role !== 'full_access') return;
  const users = await api.getUsers();
  setState({ users: Array.isArray(users) ? users : [] });
}

async function init() {
  const publicToken = getPublicTokenFromPath(window.location.pathname);
  if (publicToken) {
    await bootstrapPublicState(publicToken);
    render(state);
    return;
  }

  if (state.token) {
    await bootstrapAuthenticatedState();
  }
  render(state);
}

function render(s) {
  if (s.publicToken) {
    renderPublicPage(s);
    formEl.innerHTML = '';
    if (s.lightboxUrl) {
      renderLightbox(lbEl, s);
    } else {
      lbEl.innerHTML = '';
    }
    return;
  }

  // Main area
  if (!s.token) {
    appEl.innerHTML = '';
    renderLogin(appEl);
    formEl.innerHTML = '';
    lbEl.innerHTML = '';
    colorMap = {};
    return;
  }

  if (!s.user && !bootstrapPromise) {
    void bootstrapAuthenticatedState();
  }

  // Guard: if role changed, close modals that require full_access
  if (s.user && s.showForm && s.user.role !== 'full_access') {
    setState({ showForm: false, editingNews: null });
  }
  if (s.user && s.showUsersManager && s.user.role !== 'full_access') {
    setState({ showUsersManager: false });
  }

  renderApp(s);

  // Modal form / users manager
  if (s.showUsersManager) {
    renderUsersManager(formEl, async () => {
      await loadUsersForManager();
    });
  } else if (s.showForm) {
    renderNewsForm(formEl, async () => {
      await loadPage(s.page);
    });
  } else {
    formEl.innerHTML = '';
  }

  // Lightbox
  if (s.lightboxUrl) {
    renderLightbox(lbEl, s);
  } else {
    lbEl.innerHTML = '';
  }
}

async function bootstrapPublicState(publicToken) {
  setState({ publicToken, publicNewsItem: null, loading: true, loadError: null });
  try {
    const [item, colors] = await Promise.all([
      api.getPublicNews(publicToken),
      api.getColors(),
    ]);
    colorMap = Object.fromEntries((colors || []).map(c => [c.id, c.value]));
    setState({
      colors: Array.isArray(colors) ? colors : [],
      publicNewsItem: item,
      news: [item],
      page: 1,
      pages: 1,
      total: 1,
      loading: false,
      loadError: null,
    });
  } catch (e) {
    setState({ publicNewsItem: null, news: [], loading: false, loadError: e.message || 'Не удалось загрузить новость.' });
  }
}

function renderPublicPage(s) {
  if (!document.getElementById('public-news-container')) {
    appEl.innerHTML = `
      <header class="app-header">
        <div class="header-inner">
          <div class="header-logo">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#006D5B"/>
              <path d="M10 28L20 12L30 28H10Z" fill="white" opacity="0.9"/>
              <circle cx="20" cy="14" r="3" fill="white"/>
            </svg>
            <span>Публичная новость</span>
          </div>
          <div class="header-right">
            <a href="/" class="btn-secondary">Открыть ленту</a>
          </div>
        </div>
      </header>
      <main class="app-main">
        <div id="public-news-container" class="feed-container"></div>
      </main>
    `;
  }

  const container = document.getElementById('public-news-container');
  if (!container) return;

  if (s.loading) {
    container.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    return;
  }

  if (s.loadError || !s.publicNewsItem) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${s.loadError || 'Публичная новость не найдена.'}</p>
      </div>
    `;
    return;
  }

  const feed = document.createElement('div');
  feed.className = 'feed';
  const card = renderNewsCard(
    s.publicNewsItem,
    colorMap,
    () => {},
    () => {},
    () => {},
    false
  );
  feed.appendChild(card);
  container.innerHTML = '';
  container.appendChild(feed);
}

function getPublicTokenFromPath(pathname) {
  const normalized = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (!normalized.startsWith(PUBLIC_NEWS_PATH_PREFIX)) return null;
  const token = normalized.slice(PUBLIC_NEWS_PATH_PREFIX.length);
  return token ? decodeURIComponent(token) : null;
}

function renderApp(s) {
  const canManage = s.user?.role === 'full_access';
  const feedEl = document.getElementById('feed-container');
  if (!feedEl) {
    appEl.innerHTML = `
      <header class="app-header">
        <div class="header-inner">
          <div class="header-logo">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#006D5B"/>
              <path d="M10 28L20 12L30 28H10Z" fill="white" opacity="0.9"/>
              <circle cx="20" cy="14" r="3" fill="white"/>
            </svg>
            <span>Семейная лента</span>
          </div>
          <div class="header-right">
            <span class="header-user">${s.user?.login || ''}</span>
            <span class="header-role" title="${s.user?.role === 'full_access' ? 'Полный доступ' : 'Только чтение'}">
              ${s.user?.role === 'full_access' 
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>'
                : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>'}
            </span>
            ${canManage ? '<button id="btn-users" class="btn-secondary" title="Пользователи">Пользователи</button>' : ''}
            ${canManage ? '<button id="btn-add" class="btn-primary btn-add">Добавить</button>' : ''}
            <button id="btn-logout" class="btn-ghost" title="Выйти">Выйти</button>
          </div>
        </div>
      </header>
      <main class="app-main">
        <div id="feed-container" class="feed-container"></div>
      </main>
    `;
    if (canManage) {
      document.getElementById('btn-add').addEventListener('click', () => {
        setState({ showForm: true, editingNews: null, showUsersManager: false });
      });
      document.getElementById('btn-users').addEventListener('click', async () => {
        try {
          await loadUsersForManager();
          setState({ showUsersManager: true, showForm: false });
        } catch (e) {
          alert(e.message || 'Не удалось загрузить пользователей');
        }
      });
    }
    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('token');
      setState({ token: null, user: null, news: [], users: [], colors: [], showForm: false, showUsersManager: false, lightboxUrl: null });
    });
  }

  const fc = document.getElementById('feed-container');
  renderFeed(fc, colorMap);
}

subscribe(render);
init();
