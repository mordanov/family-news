import { useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { api } from '../api/index.js'

export default function UsersManager() {
  const users = useAppStore((s) => s.users)
  const currentUser = useAppStore((s) => s.user)
  const closeUsersManager = useAppStore((s) => s.closeUsersManager)
  const setUsers = useAppStore((s) => s.setUsers)

  const [newLogin, setNewLogin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('read_only')
  const [error, setError] = useState('')
  const [roleEdits, setRoleEdits] = useState({})

  const reload = async () => {
    const updated = await api.getUsers()
    setUsers(Array.isArray(updated) ? updated : [])
  }

  const handleCreate = async () => {
    if (!newLogin.trim() || !newPassword) {
      setError('Введите логин и пароль')
      return
    }
    setError('')
    try {
      await api.createUser({ login: newLogin.trim(), password: newPassword, role: newRole })
      setNewLogin('')
      setNewPassword('')
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDelete = async (userId) => {
    setError('')
    try {
      await api.deleteUser(userId)
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleRoleSave = async (userId) => {
    const role = roleEdits[userId]
    if (!role) return
    setError('')
    try {
      await api.updateUserRole(userId, role)
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  const getRoleValue = (u) => roleEdits[u.id] ?? u.role

  return (
    <div
      className="modal-overlay"
      id="users-overlay"
      onClick={(e) => { if (e.target.id === 'users-overlay') closeUsersManager() }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <h2>Пользователи</h2>
          <button className="btn-icon" onClick={closeUsersManager} title="Закрыть">✕</button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label>Новый пользователь</label>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Логин"
              maxLength={100}
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
            />
            <input
              type="password"
              placeholder="Пароль"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="read_only">Только чтение</option>
              <option value="full_access">Полный доступ</option>
            </select>
          </div>
          <button className="btn-primary" style={{ marginTop: '10px' }} onClick={handleCreate}>
            Добавить пользователя
          </button>
        </div>

        <div className="field">
          <label>Список пользователей</label>
          <div style={{ display: 'grid', gap: '8px' }}>
            {users.length === 0
              ? <div className="hint">Пользователи не найдены</div>
              : users.map((u) => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px' }}>
                  <div>
                    <strong>{u.login}</strong>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                      <select
                        value={getRoleValue(u)}
                        disabled={u.id === currentUser?.user_id}
                        onChange={(e) => setRoleEdits((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        style={{ width: 'auto' }}
                      >
                        <option value="read_only">Только чтение</option>
                        <option value="full_access">Полный доступ</option>
                      </select>
                      {u.id !== currentUser?.user_id && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '10px 14px', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                          onClick={() => handleRoleSave(u.id)}
                        >Сохранить</button>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    disabled={u.id === currentUser?.user_id}
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => handleDelete(u.id)}
                  >Удалить</button>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
