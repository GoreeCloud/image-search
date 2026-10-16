import { useEffect } from 'react'
import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, Copy, ExternalLink, X } from 'lucide-react'
import type { ImageResult } from '../types'

type Props = {
  image: ImageResult
  isSaved: boolean
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  onToggleSaved: () => void
  onCopy: () => void
}

export function ImageDetail({ image, isSaved, onClose, onNext, onPrevious, onToggleSaved, onCopy }: Props) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onNext()
      if (event.key === 'ArrowLeft') onPrevious()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = '' }
  }, [onClose, onNext, onPrevious])

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Image details: ${image.title}`}>
      <button className="lightbox-backdrop" type="button" onClick={onClose} aria-label="Close image preview" />
      <div className="lightbox-shell">
        <div className="lightbox-top">
          <span className="lightbox-brand"><span className="brand-dot" /> IMAGE PREVIEW</span>
          <button className="icon-button lightbox-close" onClick={onClose} type="button" aria-label="Close preview"><X size={21} /></button>
        </div>
        <div className="lightbox-main">
          <div className="preview-area">
            <button type="button" className="preview-arrow left" onClick={onPrevious} aria-label="Previous image"><ChevronLeft size={23}/></button>
            <img src={image.thumbnailUrl} alt={image.title} />
            <button type="button" className="preview-arrow right" onClick={onNext} aria-label="Next image"><ChevronRight size={23}/></button>
          </div>
          <aside className="detail-panel">
            <div className="detail-eyebrow"><span className="detail-dot" /> {image.provider}</div>
            <h2>{image.title}</h2>
            <p className="detail-description">{image.description || 'Explore this image and its source information on Wikimedia Commons.'}</p>
            <div className="detail-actions">
              <button type="button" className={`detail-save ${isSaved ? 'active' : ''}`} onClick={onToggleSaved}>
                <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
                {isSaved ? 'Saved' : 'Save image'}
              </button>
              <button type="button" className="detail-copy" onClick={onCopy} title="Copy original image URL" aria-label="Copy image link"><Copy size={18} /></button>
            </div>
            <div className="detail-metadata">
              <div><span>CREATOR</span><strong>{image.creator}</strong></div>
              <div><span>RESOLUTION</span><strong>{image.width.toLocaleString()} × {image.height.toLocaleString()}</strong></div>
              <div><span>LICENSE</span><strong>{image.license}</strong>{image.licenseUrl && <a className="license-link" href={image.licenseUrl} target="_blank" rel="noopener noreferrer">View license terms ↗</a>}</div>
            </div>
            <p className="detail-license">Check the original source for exact license, credit, and reuse requirements.</p>
            <a className="source-link" href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
              View original source <ExternalLink size={16}/>
            </a>
            <a className="original-link" href={image.url} target="_blank" rel="noopener noreferrer">
              Open original image <ArrowUpRight size={15}/>
            </a>
          </aside>
        </div>
      </div>
    </div>
  )
}
