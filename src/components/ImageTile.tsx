import { Bookmark, ArrowUpRight, ImageOff } from 'lucide-react'
import { useState } from 'react'
import type { ImageResult } from '../types'

type Props = {
  item: ImageResult
  onOpen: () => void
  onToggleSaved: () => void
  isSaved: boolean
}

export function ImageTile({ item, onOpen, onToggleSaved, isSaved }: Props) {
  const [failed, setFailed] = useState(false)
  const aspect = Math.min(1.65, Math.max(0.6, item.width / item.height))
  return (
    <article className="tile">
      <button type="button" className="tile-main" onClick={onOpen} aria-label={`View image: ${item.title}`}>
        <div className="tile-image" style={{ aspectRatio: String(aspect) }}>
          {failed
            ? <span className="tile-failed"><ImageOff size={22} /><span>Image unavailable</span></span>
            : <img src={item.thumbnailUrl} alt={item.title} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
          <span className="tile-shade" aria-hidden="true" />
          <span className="tile-info">
            <strong>{item.title}</strong>
            <small>{item.provider} <ArrowUpRight size={12} /></small>
          </span>
        </div>
      </button>
      <button type="button" className={`tile-save ${isSaved ? 'is-saved' : ''}`}
        onClick={onToggleSaved} aria-label={isSaved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
        title={isSaved ? 'Remove from saved' : 'Save image'}>
        <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}
