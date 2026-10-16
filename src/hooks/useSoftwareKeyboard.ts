import { useEffect, useState } from 'react'

/**
 * Mobile WebViews commonly resize their visual viewport when the software
 * keyboard opens without changing window.innerHeight. Use a generous
 * threshold so small browser toolbar movements do not hide navigation.
 */
export function isKeyboardOccludingViewport(
  layoutHeight: number,
  visualHeight: number,
  offsetTop: number,
  viewportWidth: number,
): boolean {
  return viewportWidth <= 680
    && layoutHeight - visualHeight - Math.max(0, offsetTop) >= 140
}

export function useSoftwareKeyboard(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const update = () => {
      setOpen(isKeyboardOccludingViewport(
        window.innerHeight,
        viewport.height,
        viewport.offsetTop,
        window.innerWidth,
      ))
    }

    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return open
}
