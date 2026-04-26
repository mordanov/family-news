import { describe, it, expect } from 'vitest'
import { getToken } from '../src/api/client.js'

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (current > 3) pages.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

describe('pageRange', () => {
  it('returns all pages when total <= 7', () => {
    expect(pageRange(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageRange(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('shows ellipsis for large page counts', () => {
    const r = pageRange(5, 10)
    expect(r[0]).toBe(1)
    expect(r[r.length - 1]).toBe(10)
    expect(r).toContain('…')
    expect(r).toContain(5)
  })

  it('no leading ellipsis when current is near start', () => {
    const r = pageRange(2, 10)
    expect(r[1]).not.toBe('…')
  })

  it('no trailing ellipsis when current is near end', () => {
    const r = pageRange(9, 10)
    expect(r[r.length - 2]).not.toBe('…')
  })

  it('first page always 1 and last page always total', () => {
    [1, 3, 5, 8, 10].forEach((p) => {
      const r = pageRange(p, 10)
      expect(r[0]).toBe(1)
      expect(r[r.length - 1]).toBe(10)
    })
  })
})

describe('getToken', () => {
  it('returns null when localStorage is empty', () => {
    localStorage.clear()
    expect(getToken()).toBeNull()
  })

  it('returns stored value', () => {
    localStorage.setItem('token', 'abc123')
    expect(getToken()).toBe('abc123')
    localStorage.removeItem('token')
  })
})
