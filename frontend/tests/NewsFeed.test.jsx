import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewsFeed from '../src/components/NewsFeed'
import { useAppStore } from '../src/store/useAppStore'

vi.mock('../src/store/useAppStore', () => ({
  useAppStore: vi.fn(),
}))

vi.mock('../src/api/index', () => ({
  api: { deleteNews: vi.fn(), getNews: vi.fn() },
}))

const mockOpenForm = vi.fn()
const mockOpenLightbox = vi.fn()
const mockSetNewsPage = vi.fn()
const mockSetLoading = vi.fn()
const mockOnLoadPage = vi.fn()

const baseStore = {
  news: [],
  loading: false,
  page: 1,
  pages: 1,
  user: { role: 'full_access', login: 'admin' },
  colors: [{ id: 'amber', value: '#F59E0B' }],
  openForm: mockOpenForm,
  openLightbox: mockOpenLightbox,
  setNewsPage: mockSetNewsPage,
  setLoading: mockSetLoading,
}

describe('NewsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.mockImplementation((selector) => selector(baseStore))
  })

  it('shows spinner when loading', () => {
    useAppStore.mockImplementation((selector) => selector({ ...baseStore, loading: true }))
    render(<NewsFeed onLoadPage={mockOnLoadPage} />)
    expect(document.querySelector('.spinner')).toBeInTheDocument()
  })

  it('shows empty state when no news', () => {
    render(<NewsFeed onLoadPage={mockOnLoadPage} />)
    expect(screen.getByText(/новостей пока нет/i)).toBeInTheDocument()
  })

  it('renders news cards', () => {
    const news = [
      { id: 1, description: 'Тест новость', color: 'amber', created_at: '2024-01-01T10:00:00Z', updated_at: '2024-01-01T10:00:00Z', photos: [], author: null },
    ]
    useAppStore.mockImplementation((selector) => selector({ ...baseStore, news }))
    render(<NewsFeed onLoadPage={mockOnLoadPage} />)
    expect(screen.getByText('Тест новость')).toBeInTheDocument()
  })

  it('does not render pagination for single page', () => {
    const news = [
      { id: 1, description: 'One', color: 'amber', created_at: '2024-01-01T10:00:00Z', updated_at: '2024-01-01T10:00:00Z', photos: [], author: null },
    ]
    useAppStore.mockImplementation((selector) => selector({ ...baseStore, news, pages: 1 }))
    render(<NewsFeed onLoadPage={mockOnLoadPage} />)
    expect(document.querySelector('.pagination')).not.toBeInTheDocument()
  })

  it('renders pagination when pages > 1', () => {
    const news = [
      { id: 1, description: 'One', color: 'amber', created_at: '2024-01-01T10:00:00Z', updated_at: '2024-01-01T10:00:00Z', photos: [], author: null },
    ]
    useAppStore.mockImplementation((selector) => selector({ ...baseStore, news, pages: 3 }))
    render(<NewsFeed onLoadPage={mockOnLoadPage} />)
    expect(document.querySelector('.pagination')).toBeInTheDocument()
  })

  it('calls onLoadPage when next page button clicked', async () => {
    const news = [
      { id: 1, description: 'One', color: 'amber', created_at: '2024-01-01T10:00:00Z', updated_at: '2024-01-01T10:00:00Z', photos: [], author: null },
    ]
    useAppStore.mockImplementation((selector) => selector({ ...baseStore, news, pages: 3, page: 1 }))
    render(<NewsFeed onLoadPage={mockOnLoadPage} />)
    await userEvent.click(screen.getByText(/вперёд/i))
    expect(mockOnLoadPage).toHaveBeenCalledWith(2)
  })

  it('hides edit/delete for read_only user', () => {
    const news = [
      { id: 1, description: 'Только чтение', color: 'amber', created_at: '2024-01-01T10:00:00Z', updated_at: '2024-01-01T10:00:00Z', photos: [], author: null },
    ]
    useAppStore.mockImplementation((selector) =>
      selector({ ...baseStore, news, user: { role: 'read_only', login: 'user' } })
    )
    render(<NewsFeed onLoadPage={mockOnLoadPage} />)
    expect(document.querySelector('.card-actions')).not.toBeInTheDocument()
  })
})
