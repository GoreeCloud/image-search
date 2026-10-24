import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import type { ImageResult } from './types'

const searchState = vi.hoisted(() => ({ images: [] as ImageResult[], loadMore: vi.fn() }))

vi.mock('./hooks/useImageSearch', () => ({
  useImageSearch: () => ({ images: searchState.images, loading: false, loadingMore: false, error: null,
    loadMoreError: null, unavailableSources: [], hasMore: false, loadMore: searchState.loadMore }),
}))
vi.mock('./hooks/useSavedImages', () => ({
  useSavedImages: () => ({ saved: [], isSaved: () => false, toggleSaved: vi.fn(), storageError: false }),
}))
vi.mock('./hooks/useThemeMode', () => ({ useThemeMode: () => ['light', vi.fn()] }))
vi.mock('./hooks/useSoftwareKeyboard', () => ({ useSoftwareKeyboard: () => false }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  searchState.images = []
  searchState.loadMore.mockClear()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(createElement(App)))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it('renders the mockup home screen with discover-first content and the mobile dock', () => {
  expect(container.querySelector('.brand-name strong')?.textContent).toBe('Image Search')
  expect(container.querySelector('.headline-row h1')?.textContent).toBe('Discover something wonderful.')
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Search images"]')?.value).toBe('')
  expect([...container.querySelectorAll('.topics button')].map(button => button.textContent)).toEqual([
    'All images', 'Nature', 'Design', 'Space', 'Travel',
  ])
  expect(container.querySelector('.topic.active')?.getAttribute('aria-pressed')).toBe('true')
  expect(container.querySelector('.results-title h2')?.textContent).toBe('Explore')
  expect(container.querySelectorAll('.mobile-nav button')).toHaveLength(3)
})

it('opens a functional filter panel and switches topics', () => {
  const trigger = container.querySelector<HTMLButtonElement>('.filter-trigger')!
  act(() => trigger.click())
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  expect(container.querySelector<HTMLSelectElement>('#orientation')?.value).toBe('all')

  const space = [...container.querySelectorAll<HTMLButtonElement>('.topics button')]
    .find(button => button.textContent === 'Space')!
  act(() => space.click())
  expect(space.getAttribute('aria-pressed')).toBe('true')
  expect(container.querySelector('.results-title h2')?.textContent).toBe('Explore space')

  act(() => container.querySelector<HTMLButtonElement>('.brand')!.click())
  expect(container.querySelector('.results-title h2')?.textContent).toBe('Explore')
  expect(container.querySelector('.topic.active')?.textContent).toBe('All images')
})

it('progressively reveals fetched results without requesting another provider page', () => {
  searchState.images = Array.from({ length: 121 }, (_, index) => ({
    id: `commons:${index}`, title: `Image ${index}`, url: `https://example.org/${index}.jpg`,
    thumbnailUrl: `https://example.org/thumb-${index}.jpg`,
    sourceUrl: `https://example.org/wiki/${index}`, description: '', creator: 'Example',
    license: 'CC BY', licenseUrl: null, width: 1200, height: 800, provider: 'Wikimedia Commons',
  }))
  act(() => root.render(createElement(App)))

  expect(container.querySelectorAll('.masonry .tile')).toHaveLength(48)
  expect(container.querySelector('.results-title span')?.textContent).toContain('48 of 121 images')

  const more = container.querySelector<HTMLButtonElement>('.load-row button')!
  act(() => more.click())
  expect(container.querySelectorAll('.masonry .tile')).toHaveLength(96)
  act(() => more.click())
  expect(container.querySelectorAll('.masonry .tile')).toHaveLength(121)
  expect(searchState.loadMore).not.toHaveBeenCalled()
  expect(container.querySelector('.load-row')).toBeNull()
})
