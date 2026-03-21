import { api } from './api.js';
import { state, setState, subscribe } from './state.js';
import { renderLogin } from './components/Login.js';
import { renderFeed, loadPage } from './components/Feed.js';
import { renderNewsForm } from './components/NewsForm.js';
import { renderLightbox } from './components/Lightbox.js';
import { renderUsersManager } from './components/UsersManager.js';

const appEl = document.getElementById('app');
const formEl = document.getElementById('form-mount');
const lbEl = document.getElementById('lightbox-mount');

let colorMap = {};
let bootstrapPromise = null;
let bootstrappedToken = null;
let bootstrapFailedToken = null;

async function bootstrapAuthenticatedState() {
  if (!state.token) return;
  if (bootstrapPromise) return bootstrapPromise;
  if (bootstrappedToken === state.token && state.user) return;
  if (bootstrapFailedToken === state.token && !state.user) return;

  const activeToken = state.token;
  bootstrapPromise = (async () => {
    try {
      setState({ loading: true, loadError: null });
      const me = await api.me();
      const colors = await api.getColors();
      colorMap = Object.fromEntries(colors.map(c => [c.id, c.value]));
      setState({ user: me, colors });
      await loadPage(1);
      bootstrappedToken = activeToken;
      bootstrapFailedToken = null;
    } catch (e) {
      if (e?.code === 'UNAUTHORIZED') {
        localStorage.removeItem('token');
        colorMap = {};
        bootstrappedToken = null;
        bootstrapFailedToken = null;
        setState({ token: null, user: null, loading: false });
        return;
      }

      bootstrapFailedToken = activeToken;
      setState({ loading: false, loadError: e?.message || 'Не удалось загрузить данные профиля.' });
      return;

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
  if (state.token) {
    await bootstrapAuthenticatedState();
  }
  render(state);
}

function render(s) {
  // Main area
  if (!s.token) {
    appEl.innerHTML = '';
    renderLogin(appEl);
    formEl.innerHTML = '';
    lbEl.innerHTML = '';
    colorMap = {};
    bootstrappedToken = null;
    bootstrapFailedToken = null;
    return;
  }

  if (!s.user && !bootstrapPromise) {
    void bootstrapAuthenticatedState();
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
            <span class="header-role" style="font-size:12px; color:#666;">${s.user?.role === 'full_access' ? '🔑 Полный доступ' : '👁️ Только чтение'}</span>
            ${canManage ? '<button id="btn-users" class="btn-secondary" title="Пользователи">Пользователи</button>' : ''}
            ${canManage ? '<button id="btn-add" class="btn-primary btn-add">+ Добавить</button>' : ''}
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
      setState({ token: null, user: null, news: [], users: [], showForm: false, showUsersManager: false });
    });
  }

  const fc = document.getElementById('feed-container');
  renderFeed(fc, colorMap);
}

subscribe(render);
init();
