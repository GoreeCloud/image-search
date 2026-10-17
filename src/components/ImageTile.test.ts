import { act } from 'react'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageResult } from '../types'
import { ImageTile } from './ImageTile'

const image: ImageResult = {
  id: 'web:1', title: 'Samsung One UI', thumbnailUrl: 'https://example.org/oneui-thumb.jpg',
  url: 'https://example.org/oneui.jpg', sourceUrl: 'https://example.org/post',
  description: '', creator: 'Original publisher', license: 'Web result · rights unverified',
  licenseUrl: 'https://example.org/rights', provider: 'GoreeCloud Search', width: 900, height: 1600,
}
let root: Root
let host: HTMLDivElement
const onOpen = vi.fn()
const onDownload = vi.fn()
const onToggleSaved = vi.fn()
function button(label: string): HTMLButtonElement {
  const result = Array.from(host.querySelectorAll('button')).find(el => el.getAttribute('aria-label') === label || el.textContent?.includes(label))
  if (!result) throw new Error('Missing button: ' + label)
  return result
}
async function render(saved = false, license = image.license, busy = false) {
  await act(async () => root.render(createElement(ImageTile, {
    item: { ...image, license }, isSaved: saved, isDownloading: busy, downloadBusy: busy,
    onOpen, onDownload, onToggleSaved,
  })))
}
async function click(label: string) {
  await act(async () => button(label).click())
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  onOpen.mockClear(); onDownload.mockClear(); onToggleSaved.mockClear()
  vi.unstubAllGlobals()
})

describe('single image actions menu', () => {
  it('renders one overlay button with a visible rights badge and no separate download/save controls', async () => {
    await render()
    expect(host.querySelectorAll('.tile-menu-trigger')).toHaveLength(1)
    expect(host.querySelectorAll('.tile-download,.tile-save,.tile-copyright')).toHaveLength(0)
    expect(host.querySelector('.tile-menu-rights')?.textContent).toBe('©')
    expect(host.querySelector('[role="menu"]')).toBeNull()
    await click('Image actions for Samsung One UI')
    const menu = host.querySelector('[role="menu"]')
    expect(menu).not.toBeNull()
    expect(menu?.querySelectorAll('[role="menuitem"]')).toHaveLength(4)
    expect(menu?.textContent).toContain('Copyright & license')
    expect(menu?.querySelector('a[href="https://example.org/rights"]')).not.toBeNull()
    expect(button('Image actions for Samsung One UI').getAttribute('aria-expanded')).toBe('true')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('executes Download and Save from the menu and closes after either action', async () => {
    await render()
    await click('Image actions for Samsung One UI')
    await click('Download image')
    expect(onDownload).toHaveBeenCalledOnce()
    expect(host.querySelector('[role="menu"]')).toBeNull()
    await click('Image actions for Samsung One UI')
    await click('Save image')
    expect(onToggleSaved).toHaveBeenCalledOnce()
    expect(host.querySelector('[role="menu"]')).toBeNull()
    await render(true)
    await click('Image actions for Samsung One UI')
    expect(host.textContent).toContain('Remove saved image')
  })

  it('closes on Escape and outside pointer input, preserving thumbnail opening', async () => {
    await render()
    await click('Image actions for Samsung One UI')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(host.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(button('Image actions for Samsung One UI'))
    await click('Image actions for Samsung One UI')
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(host.querySelector('[role="menu"]')).toBeNull()
    await click('View image: Samsung One UI')
    expect(onOpen).toHaveBeenCalledOnce()
  })


  it('supports arrow-key and Home/End navigation in the menu', async () => {
    await render()
    await click('Image actions for Samsung One UI')
    const menu = host.querySelector('[role="menu"]')
    expect(menu).not.toBeNull()
    const links = menu!.querySelectorAll('[role="menuitem"]')
    expect(document.activeElement).toBe(links[0])
    await act(async () => menu!.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown',bubbles:true})))
    expect(document.activeElement).toBe(links[1])
    await act(async () => menu!.dispatchEvent(new KeyboardEvent('keydown', {key:'End',bubbles:true})))
    expect(document.activeElement).toBe(links[3])
    await act(async () => menu!.dispatchEvent(new KeyboardEvent('keydown', {key:'Home',bubbles:true})))
    expect(document.activeElement).toBe(links[0])
  })

  it('does not show a copyright badge for CC0, and disables download while busy', async () => {
    await render(false, 'CC0 · Open Access', true)
    expect(host.querySelector('.tile-menu-rights')).toBeNull()
    await click('Image actions for Samsung One UI')
    expect(button('Downloading…').disabled).toBe(true)
    expect(host.textContent).toContain('Public domain / CC0 reported')
    expect(onDownload).not.toHaveBeenCalled()
  })
})
