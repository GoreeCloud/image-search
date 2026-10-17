import { Bookmark, ArrowUpRight, Download, Copyright, ImageOff, LoaderCircle, MoreVertical, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ImageResult } from '../types'
import { showCopyrightNotice } from '../services/imageRights'
import { trustedImageFallback } from '../services/imageFallback'

type Props = {
  item: ImageResult
  onOpen: () => void
  onToggleSaved: () => void
  onDownload: () => void
  isDownloading: boolean
  downloadBusy: boolean
  isSaved: boolean
}

export function ImageTile({ item, onOpen, onToggleSaved, onDownload, isDownloading, downloadBusy, isSaved }: Props) {
  const [imageUrl, setImageUrl] = useState(item.thumbnailUrl)
  const [failed, setFailed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRoot = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstItem = useRef<HTMLButtonElement>(null)
  const aspect = Math.min(1.65, Math.max(0.6, item.width / item.height))

  useEffect(() => {
    setImageUrl(item.thumbnailUrl)
    setFailed(false)
    setMenuOpen(false)
  }, [item.id, item.thumbnailUrl])

  useEffect(() => {
    if (!menuOpen) return
    function pointerDown(event: PointerEvent) {
      if (!menuRoot.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setMenuOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', pointerDown)
    document.addEventListener('keydown', keyDown, true)
    return () => {
      document.removeEventListener('pointerdown', pointerDown)
      document.removeEventListener('keydown', keyDown, true)
    }
  }, [menuOpen])

  useEffect(() => { if (menuOpen) firstItem.current?.focus() }, [menuOpen])

  function action(fn: () => void) { setMenuOpen(false); fn() }

  const imageError = () => {
    const fallback = trustedImageFallback(item)
    if (imageUrl === item.thumbnailUrl && fallback) setImageUrl(fallback)
    else setFailed(true)
  }

  const retry = () => {
    setFailed(false)
    setImageUrl(item.thumbnailUrl)
  }

  return (
    <article className={`tile ${menuOpen ? "tile-menu-open" : ""}`}>
      <button type="button" className="tile-main" onClick={failed ? retry : onOpen}
        aria-label={failed ? `Retry image preview: ${item.title}` : `View image: ${item.title}`}>
        <div className="tile-image" style={{ aspectRatio: String(aspect) }}>
          {failed
            ? <span className="tile-failed"><ImageOff size={22} /><span>Preview unavailable</span><span><RefreshCw size={13} /> Tap to retry</span></span>
            : <img src={imageUrl} alt={item.title} loading="lazy" decoding="async" onError={imageError} referrerPolicy="no-referrer" />}
          <span className="tile-shade" aria-hidden="true" />
          {!failed && <span className="tile-info">
            <strong>{item.title}</strong>
            <small>{item.provider} <ArrowUpRight size={12} /></small>
          </span>}
        </div>
      </button>
      <div className="tile-menu-root" ref={menuRoot}>
        <button ref={trigger} type="button" className="tile-menu-trigger"
          aria-label={`Image actions for ${item.title}`} aria-haspopup="menu" aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}>
          <MoreVertical size={19}/>
          {showCopyrightNotice(item) && <span aria-hidden="true" className="tile-menu-rights">©</span>}
        </button>
        {menuOpen && <div className="tile-actions-menu" role="menu" aria-label={`Actions for ${item.title}`}>
          <button ref={firstItem} type="button" role="menuitem" disabled={downloadBusy} onClick={() => action(onDownload)}>
            {isDownloading ? <LoaderCircle size={17} className="download-spinner"/> : <Download size={17}/>}
            {isDownloading ? 'Downloading…' : 'Download image'}
          </button>
          <button type="button" role="menuitem" onClick={() => action(onToggleSaved)}>
            <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'}/>
            {isSaved ? 'Remove saved image' : 'Save image'}
          </button>
          <a role="menuitem" href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
            <ArrowUpRight size={17}/> View original source
          </a>
          <a role="menuitem" href={item.licenseUrl || item.sourceUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}>
            <Copyright size={17}/> Copyright &amp; license
          </a>
          <p className="tile-menu-rights-note">{showCopyrightNotice(item)
            ? '© Reuse rights may apply. Verify at source.'
            : 'Public domain / CC0 reported. Verify at source.'}</p>
        </div>}
      </div>
    </article>
  )
}
