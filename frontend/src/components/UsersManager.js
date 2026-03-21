import { api } from '../api.js';
import { state, setState } from '../state.js';

export function renderUsersManager(container, onUsersChanged) {
  if (state.user?.role !== 'full_access') {
    setState({ showUsersManager: false });
    return;
  }

  const users = Array.isArray(state.users) ? state.users : [];

  container.innerHTML = `
    <div class="modal-overlay" id="users-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Пользователи</h2>
          <button class="btn-icon" id="close-users" title="Закрыть">✕</button>
        </div>

        <div id="users-error" class="form-error hidden"></div>

        <div class="field">
          <label>Новый пользователь</label>
          <div style="display:grid; gap:8px; grid-template-columns:1fr 1fr auto; align-items:center;">
            <input id="new-user-login" type="text" placeholder="Логин" maxlength="100" />
            <input id="new-user-password" type="password" placeholder="Пароль" />
            <select id="new-user-role">
              <option value="read_only">Только чтение</option>
              <option value="full_access">Полный доступ</option>
            </select>
          </div>
          <button id="create-user-btn" class="btn-primary" style="margin-top:10px;">Добавить пользователя</button>
        </div>

        <div class="field">
          <label>Список пользователей</label>
          <div id="users-list" style="display:grid; gap:8px;">
            ${users.length === 0 ? '<div class="hint">Пользователи не найдены</div>' : users.map(u => `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; border:1px solid #e5e7eb; border-radius:10px; padding:10px;">
                <div>
                  <strong>${escHtml(u.login)}</strong>
                  <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
                    <select class="role-select" data-user-id="${u.id}" ${u.id === state.user?.user_id ? 'disabled' : ''}>
                      <option value="read_only" ${u.role === 'read_only' ? 'selected' : ''}>Только чтение</option>
                      <option value="full_access" ${u.role === 'full_access' ? 'selected' : ''}>Полный доступ</option>
                    </select>
                    ${u.id !== state.user?.user_id ? `<button class="btn-secondary" style="padding:4px 8px; font-size:12px;" data-role-save="${u.id}">Сохранить</button>` : ''}
                  </div>
                </div>
                <button class="btn-secondary" data-delete-user="${u.id}" ${u.id === state.user?.user_id ? 'disabled' : ''} style="white-space:nowrap;">Удалить</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  const errEl = container.querySelector('#users-error');
  const close = () => setState({ showUsersManager: false });

  container.querySelector('#close-users').addEventListener('click', close);
  container.querySelector('#users-overlay').addEventListener('click', e => {
    if (e.target.id === 'users-overlay') close();
  });

  container.querySelector('#create-user-btn').addEventListener('click', async () => {
    const login = container.querySelector('#new-user-login').value.trim();
    const password = container.querySelector('#new-user-password').value;
    const role = container.querySelector('#new-user-role').value;
    errEl.classList.add('hidden');

    if (!login || !password) {
      errEl.textContent = 'Введите логин и пароль';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await api.createUser({ login, password, role });
      await onUsersChanged?.();
      container.querySelector('#new-user-login').value = '';
      container.querySelector('#new-user-password').value = '';
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  });

  container.querySelectorAll('[data-delete-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = Number(btn.dataset.deleteUser);
      if (!userId) return;
      errEl.classList.add('hidden');
      try {
        await api.deleteUser(userId);
        await onUsersChanged?.();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
      }
    });
  });

  container.querySelectorAll('[data-role-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = Number(btn.dataset.roleSave);
      const select = container.querySelector(`[data-user-id="${userId}"]`);
      if (!select) return;
      const newRole = select.value;
      errEl.classList.add('hidden');
      try {
        await api.updateUserRole(userId, newRole);
        await onUsersChanged?.();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
      }
    });
  });
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


