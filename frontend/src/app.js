import { api } from './api.js';
import { state, setState, subscribe } from './state.js';
import { renderLogin } from './components/Login.js';
import { renderFeed, loadPage } from './components/Feed.js';
import { renderNewsForm } from './components/NewsForm.js';
import { renderLightbox } from './components/Lightbox.js';

const appEl = document.getElementById('app');
const formEl = document.getElementById('form-mount');
const lbEl = document.getElementById('lightbox-mount');

let colorMap = {};

async function init() {
  if (state.token) {
    try {
      const me = await api.me();
      setState({ user: me });
      const colors = await api.getColors();
      setState({ colors });
      colorMap = Object.fromEntries(colors.map(c => [c.id, c.value]));
      await loadPage(1);
    } catch {
      localStorage.removeItem('token');
      setState({ token: null });
    }
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
    return;
  }

  renderApp(s);

  // Modal form
  if (s.showForm) {
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
            <button id="btn-add" class="btn-primary btn-add">+ Добавить</button>
            <button id="btn-logout" class="btn-ghost" title="Выйти">Выйти</button>
          </div>
        </div>
      </header>
      <main class="app-main">
        <div id="feed-container" class="feed-container"></div>
      </main>
    `;
    document.getElementById('btn-add').addEventListener('click', () => {
      setState({ showForm: true, editingNews: null });
    });
    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('token');
      setState({ token: null, user: null, news: [], showForm: false });
    });
  }

  const fc = document.getElementById('feed-container');
  renderFeed(fc, colorMap);
}

subscribe(render);
init();
