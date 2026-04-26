import { useAppStore } from '../store/useAppStore.js'
import { api } from '../api/index.js'

export default function Header({ onLoadPage }) {
  const user = useAppStore((s) => s.user)
  const logout = useAppStore((s) => s.logout)
  const openForm = useAppStore((s) => s.openForm)
  const openUsersManager = useAppStore((s) => s.openUsersManager)
  const setUsers = useAppStore((s) => s.setUsers)
  const canManage = user?.role === 'full_access'

  const handleUsers = async () => {
    try {
      const users = await api.getUsers()
      setUsers(Array.isArray(users) ? users : [])
      openUsersManager()
    } catch (e) {
      alert(e.message || 'Не удалось загрузить пользователей')
    }
  }

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-logo">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#006D5B"/>
            <path d="M10 28L20 12L30 28H10Z" fill="white" opacity="0.9"/>
            <circle cx="20" cy="14" r="3" fill="white"/>
          </svg>
          <span>Семейная лента</span>
        </div>
        <div className="header-right">
          <span className="header-user">{user?.login || ''}</span>
          <span
            className="header-role"
            title={user?.role === 'full_access' ? 'Полный доступ' : 'Только чтение'}
          >
            {user?.role === 'full_access' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            )}
          </span>
          {canManage && (
            <button className="btn-secondary" onClick={handleUsers}>Пользователи</button>
          )}
          {canManage && (
            <button className="btn-primary btn-add" onClick={() => openForm(null)}>Добавить</button>
          )}
          <button className="btn-ghost" onClick={logout}>Выйти</button>
        </div>
      </div>
    </header>
  )
}
