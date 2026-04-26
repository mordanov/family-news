import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem:    (key) => store[key] ?? null,
    setItem:    (key, val) => { store[key] = String(val) },
    removeItem: (key) => { delete store[key] },
    clear:      () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
})

// Mock window.location
delete window.location
window.location = { href: '' }

// Mock fetch
global.fetch = vi.fn()
