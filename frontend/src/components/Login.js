import { api } from '../api.js';
import { setState } from '../state.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#006D5B"/>
            <path d="M10 28L20 12L30 28H10Z" fill="white" opacity="0.9"/>
            <circle cx="20" cy="14" r="3" fill="white"/>
          </svg>
          <span>Семейная лента</span>
        </div>
        <h1>Добро пожаловать</h1>
        <p class="login-sub">Войдите, чтобы видеть новости семьи</p>
        <div id="login-error" class="login-error hidden"></div>
        <div class="field">
          <label for="login-input">Логин</label>
          <input id="login-input" type="text" autocomplete="username" placeholder="Введите логин" />
        </div>
        <div class="field">
          <label for="pass-input">Пароль</label>
          <input id="pass-input" type="password" autocomplete="current-password" placeholder="Введите пароль" />
        </div>
        <label id="remember-label" style="display:flex;align-items:center;width:100%;gap:0.5rem;font-size:13px;cursor:pointer;padding:2px 0">
          <input id="remember-check" type="checkbox" style="flex-shrink:0" />
          <span style="flex:1">Запомнить меня</span>
        </label>
        <button id="login-btn" class="btn-primary btn-full">Войти</button>
      </div>
    </div>
  `;

  const loginInput = container.querySelector('#login-input');
  const passInput = container.querySelector('#pass-input');
  const btn = container.querySelector('#login-btn');
  const errEl = container.querySelector('#login-error');
  const rememberCheck = container.querySelector('#remember-check');

  rememberCheck.checked = localStorage.getItem('remember_me') === 'true';

  const setCookie = (name, value, days) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
  };

  async function doLogin() {
    const login = loginInput.value.trim();
    const password = passInput.value;
    const rememberMe = rememberCheck.checked;
    if (!login || !password) return;

    localStorage.setItem('remember_me', String(rememberMe));
    btn.disabled = true;
    btn.textContent = 'Входим…';
    errEl.classList.add('hidden');

    try {
      const data = await api.login(login, password, rememberMe);
      localStorage.setItem('token', data.access_token);
      if (rememberMe) setCookie('remembered_token', data.access_token, 30);
      setState({ token: data.access_token });
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  }

  btn.addEventListener('click', doLogin);
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  loginInput.addEventListener('keydown', e => { if (e.key === 'Enter') passInput.focus(); });
}
