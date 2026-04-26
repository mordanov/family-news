import { useState } from 'react'
import { api } from '../api/index.js'
import { useAppStore } from '../store/useAppStore.js'
import { setCookie } from '../utils/cookies.js'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('remember_me') === 'true')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setToken = useAppStore((s) => s.setToken)

  const doLogin = async () => {
    if (!login.trim() || !password) return
    localStorage.setItem('remember_me', String(rememberMe))
    setError('')
    setLoading(true)
    try {
      const data = await api.login(login.trim(), password, rememberMe)
      localStorage.setItem('token', data.access_token)
      if (rememberMe) setCookie('remembered_token', data.access_token, 30)
      setToken(data.access_token)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e, next) => {
    if (e.key === 'Enter') next ? next.focus() : doLogin()
  }

  let passRef = null

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#006D5B"/>
            <path d="M10 28L20 12L30 28H10Z" fill="white" opacity="0.9"/>
            <circle cx="20" cy="14" r="3" fill="white"/>
          </svg>
          <span>Семейная лента</span>
        </div>
        <h1>Добро пожаловать</h1>
        <p className="login-sub">Войдите, чтобы видеть новости семьи</p>
        {error && <div className="login-error">{error}</div>}
        <div className="field">
          <label htmlFor="login-input">Логин</label>
          <input
            id="login-input"
            type="text"
            autoComplete="username"
            placeholder="Введите логин"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => onKeyDown(e, passRef)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="pass-input">Пароль</label>
          <input
            id="pass-input"
            type="password"
            autoComplete="current-password"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doLogin() }}
            ref={(el) => { passRef = el }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem', fontSize: '13px', cursor: 'pointer', padding: '2px 0', marginBottom: '18px' }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ flexShrink: 0 }}
          />
          <span style={{ flex: 1 }}>Запомнить меня</span>
        </label>
        <button
          className="btn-primary btn-full"
          onClick={doLogin}
          disabled={loading}
        >
          {loading ? 'Входим…' : 'Войти'}
        </button>
      </div>
    </div>
  )
}
