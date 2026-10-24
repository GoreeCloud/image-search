import { Bookmark, ArrowUpRight, Download, ImageOff, LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ImageResult } from '../types'
import { trustedImageFallback } from '../services/imageFallback'

type Props = {
  item: ImageResult
  onOpen: () => void
  onToggleSaved: () => void
  onDownload: () => void
  onRights: () => void
  isDownloading: boolean
  downloadBusy: boolean
  isSaved: boolean
}

export function ImageTile({ item, onOpen, onToggleSaved, onDownload, onRights, isDownloading, downloadBusy, isSaved }: Props) {
  const [imageUrl, setImageUrl] = useState(item.thumbnailUrl)
  const [failed, setFailed] = useState(false)
  const aspect = Math.min(1.65, Math.max(0.6, item.width / item.height))
  const sourceBadge = item.provider.startsWith('Wikimedia Commons') ? 'Wikimedia'
    : item.provider.startsWith('Openverse') ? 'Openverse'
      : item.provider === 'NASA Image Library' ? 'NASA' : item.provider

  useEffect(() => {
    setImageUrl(item.thumbnailUrl)
    setFailed(false)
  }, [item.id, item.thumbnailUrl])

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
    <article className="tile">
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
      <a className="tile-source" href={item.sourceUrl} target="_blank"
        rel="noopener noreferrer" aria-label={`View ${item.title} on ${item.provider}`}>{failed ? 'View source' : sourceBadge} <ArrowUpRight size={12} /></a>
      <div className="tile-actions">
        <button type="button" className="tile-download" onClick={onDownload} disabled={downloadBusy}
          aria-label={isDownloading ? `Downloading ${item.title}` : `Download ${item.title}`}
          title={isDownloading ? 'Downloading original image' : 'Download original image'}>
          {isDownloading ? <LoaderCircle size={18} className="download-spinner" /> : <Download size={18} />}
        </button>
        <button type="button" className={`tile-save ${isSaved ? 'is-saved' : ''}`}
          onClick={onToggleSaved} aria-label={isSaved ? `Remove ${item.title} from saved` : `Save image`}
          title={isSaved ? 'Remove from saved' : 'Save image'}>
          <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className="tile-rights" onClick={onRights}
          aria-label={`View image rights and attribution for ${item.title}`} title="Image rights and attribution">©</button>
      </div>
    </article>
  )
}
