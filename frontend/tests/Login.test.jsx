import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../src/pages/LoginPage'
import { useAppStore } from '../src/store/useAppStore'

vi.mock('../src/store/useAppStore', () => ({
  useAppStore: vi.fn(),
}))

vi.mock('../src/api/index', () => ({
  api: {
    login: vi.fn(),
  },
}))

import { api } from '../src/api/index'

const mockSetToken = vi.fn()

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.mockImplementation((selector) =>
      selector({ setToken: mockSetToken })
    )
    localStorage.clear()
  })

  it('renders login and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText('Логин')).toBeInTheDocument()
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
  })

  it('renders a sign in button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument()
  })

  it('renders remember me checkbox', () => {
    render(<LoginPage />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('calls api.login and setToken on successful submit', async () => {
    api.login.mockResolvedValue({ access_token: 'tok123' })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText('Логин'), 'user1')
    await userEvent.type(screen.getByLabelText('Пароль'), 'pass1')
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() => expect(api.login).toHaveBeenCalledWith('user1', 'pass1', false))
    await waitFor(() => expect(mockSetToken).toHaveBeenCalledWith('tok123'))
  })

  it('shows error on failed login', async () => {
    api.login.mockRejectedValue(new Error('Неверный логин или пароль'))
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText('Логин'), 'user1')
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() =>
      expect(screen.getByText('Неверный логин или пароль')).toBeInTheDocument()
    )
  })

  it('disables button while loading', async () => {
    let resolve
    api.login.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText('Логин'), 'user1')
    await userEvent.type(screen.getByLabelText('Пароль'), 'pass1')
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))

    expect(screen.getByRole('button', { name: /входим/i })).toBeDisabled()
    resolve({ access_token: 'tok' })
  })

  it('passes rememberMe=true when checkbox checked', async () => {
    api.login.mockResolvedValue({ access_token: 'tok' })
    render(<LoginPage />)

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.type(screen.getByLabelText('Логин'), 'user1')
    await userEvent.type(screen.getByLabelText('Пароль'), 'pass1')
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() => expect(api.login).toHaveBeenCalledWith('user1', 'pass1', true))
  })
})
