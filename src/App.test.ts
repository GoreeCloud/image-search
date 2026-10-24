import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import type { ImageResult } from './types'

const savedState = vi.hoisted(() => ({ images: [] as ImageResult[] }))

vi.mock('./hooks/useImageSearch', () => ({
  useImageSearch: () => ({ images: [], loading: false, loadingMore: false, error: null,
    loadMoreError: null, unavailableSources: [], hasMore: false, loadMore: vi.fn() }),
}))
vi.mock('./hooks/useSavedImages', () => ({
  useSavedImages: () => ({ saved: savedState.images, isSaved: () => false, toggleSaved: vi.fn(), storageError: false }),
}))
vi.mock('./hooks/useThemeMode', () => ({ useThemeMode: () => ['light', vi.fn()] }))
vi.mock('./hooks/useSoftwareKeyboard', () => ({ useSoftwareKeyboard: () => false }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  savedState.images = []
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

it('shows all saved items even after an Explore orientation filter was selected', () => {
  savedState.images = [{
    id: 'saved-landscape', title: 'Saved mountain landscape', url: 'https://example.org/large.jpg',
    thumbnailUrl: 'https://example.org/thumb.jpg', sourceUrl: 'https://example.org/image',
    description: '', creator: 'Example', license: 'CC0', licenseUrl: null,
    width: 1200, height: 800, dimensionsKnown: true, provider: 'Example',
  }]
  act(() => root.render(createElement(App)))

  act(() => container.querySelector<HTMLButtonElement>('.filter-trigger')!.click())
  const select = container.querySelector<HTMLSelectElement>('#orientation')!
  act(() => {
    select.value = 'portrait'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(select.value).toBe('portrait')

  act(() => container.querySelector<HTMLButtonElement>('.mobile-nav button:nth-child(2)')!.click())
  expect(container.querySelector('.results-title h2')?.textContent).toBe('Saved')
  expect(container.querySelector<HTMLButtonElement>('[aria-label="View image: Saved mountain landscape"]')).not.toBeNull()
})
