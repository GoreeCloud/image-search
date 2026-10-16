import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Bookmark, Compass, Images, Search, SlidersHorizontal, Sparkles, X, RotateCcw, Settings2 } from 'lucide-react'
import { ImageTile } from './components/ImageTile'
import { ImageDetail } from './components/ImageDetail'
import { SettingsPage } from './components/SettingsPage'
import { useThemeMode } from './hooks/useThemeMode'
import { hasEuropeanaKey } from './services/apiKeys'
import { hasWebImageEndpoint } from './services/webImages'
import { downloadOriginalImage, isNativeAndroidDownload } from './services/downloadImage'
import './settings.css'
import { useImageSearch } from './hooks/useImageSearch'
import { useSavedImages } from './hooks/useSavedImages'
import { useSoftwareKeyboard } from './hooks/useSoftwareKeyboard'
import type { ImageSource } from './services/providers'
import type { ImageResult } from './types'

const TOPICS = ['Nature', 'Architecture', 'Interiors', 'Travel', 'Wildlife', 'Flowers', 'Textures']
type View = 'explore' | 'saved' | 'settings'
type Orientation = 'all' | 'landscape' | 'portrait' | 'square'
const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: 'all', label: 'All images' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'square', label: 'Square' },
]

function isOrientation(image: ImageResult, orientation: Orientation) {
  const ratio = image.width / image.height
  return orientation === 'all'
    || (orientation === 'landscape' && ratio > 1.2)
    || (orientation === 'portrait' && ratio < 0.83)
    || (orientation === 'square' && ratio >= 0.83 && ratio <= 1.2)
}

export default function App() {
  const [input, setInput] = useState('nature')
  const [query, setQuery] = useState('nature')
  const [view, setView] = useState<View>('explore')
  const [orientation, setOrientation] = useState<Orientation>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [source, setSource] = useState<ImageSource>('all')
  const keyboardOpen = useSoftwareKeyboard()
  const [theme, setTheme] = useThemeMode()
  const searchRef = useRef<HTMLInputElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const { images, loading, loadingMore, error, loadMoreError, hasMore, loadMore } = useImageSearch(query, refresh, source)
  const { saved, isSaved, toggleSaved, storageError } = useSavedImages()
  const visible = useMemo(() => (view === 'saved' ? saved : images).filter((item) => isOrientation(item, orientation)), [view, saved, images, orientation])
  const currentIndex = visible.findIndex((item) => item.id === detailId)
  const selected = currentIndex >= 0 ? visible[currentIndex] : null

  useEffect(() => {
    const node = sentinel.current
    if (!node || view !== 'explore' || !hasMore || error || loadMoreError || loading) return
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void loadMore() }, { rootMargin: '800px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore, view, hasMore, error, loadMoreError, loading])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (detailId === null && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [detailId])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = input.trim()
    if (!next) { searchRef.current?.focus(); return }
    setView('explore')
    setOrientation('all')
    setQuery(next)
    if (query === next) setRefresh((n) => n + 1)
    setDetailId(null)
    searchRef.current?.blur()
  }

  function chooseTopic(topic: string) {
    setInput(topic.toLowerCase())
    setQuery(topic.toLowerCase())
    setView('explore')
    setOrientation('all')
    setDetailId(null)
    if (query === topic.toLowerCase()) setRefresh((n) => n + 1)
  }

  function onApiChange() {
    if ((source === 'europeana' && !hasEuropeanaKey()) || (source === 'web' && !hasWebImageEndpoint())) setSource('all')
    setRefresh(n => n + 1)
  }

  const closeDetail = useCallback(() => setDetailId(null), [])
  const nextDetail = useCallback(() => {
    setDetailId((id) => {
      const index = visible.findIndex((item) => item.id === id)
      return visible.length ? visible[(index + 1) % visible.length].id : null
    })
  }, [visible])
  const previousDetail = useCallback(() => {
    setDetailId((id) => {
      const index = visible.findIndex((item) => item.id === id)
      return visible.length ? visible[(index - 1 + visible.length) % visible.length].id : null
    })
  }, [visible])

  async function startImageDownload(image: ImageResult) {
    if (downloadingId !== null) return
    setDownloadingId(image.id)
    try {
      const filename = await downloadOriginalImage(image)
      setToast((isNativeAndroidDownload() ? 'Saved to Downloads: ' : 'Download started: ') + filename)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Image download failed. Open the original image instead.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function copyImageUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setToast('Image link copied')
    } catch {
      setToast('Copy unavailable — open the original image instead')
    }
  }

  return (
    <div className={keyboardOpen ? "app-shell ime-open" : "app-shell"}>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={() => { setView('explore'); setOrientation('all') }} aria-label="Image Search home">
            <span className="brand-mark"><img src="/app-icon.svg" alt="" /></span>
            <span className="brand-name">image<span>search</span><b className="brand-beta">BETA</b></span>
          </button>
          <form className="search-form" role="search" onSubmit={submitSearch}>
            <Search size={19} className="search-icon" />
            <input ref={searchRef} autoComplete="off" aria-label="Search images" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Search millions of images..." maxLength={180} />
            {input && <button className="clear-search" onClick={() => { setInput(''); searchRef.current?.focus() }} type="button" aria-label="Clear search"><X size={16} /></button>}
            <span className="search-shortcut" aria-hidden="true">⌘ K</span>
            <button className="search-submit" type="submit">Search</button>
          </form>
          <nav className="topnav" aria-label="Main navigation">
            <button type="button" className={`nav-link ${view === 'explore' ? 'selected' : ''}`} onClick={() => setView('explore')}><Compass size={18}/><span>Explore</span></button>
            <button type="button" className={`nav-link ${view === 'saved' ? 'selected' : ''}`} onClick={() => setView('saved')}><Bookmark size={18}/><span>Saved</span>{saved.length > 0 && <em>{saved.length}</em>}</button>
            <button type="button" className={`nav-link ${view === 'settings' ? 'selected' : ''}`} onClick={() => setView('settings')} aria-label="Settings"><Settings2 size={18}/><span>Settings</span></button>
          </nav>
        </div>
      </header>

      <main className="page-main">
        {view === 'settings' ? <SettingsPage theme={theme} onThemeChange={setTheme} onApiChange={onApiChange}/> : <>
        <div className="headline-row">
          <div>
            <div className="eyebrow"><Sparkles size={14}/>{view === 'explore' ? 'YOUR VISUAL DISCOVERY SPACE' : 'YOUR PERSONAL COLLECTION'}</div>
            <h1>{view === 'explore' ? <>A world of <em>inspiration.</em></> : <>All your <em>favorites.</em></>}</h1>
            <p>{view === 'explore' ? 'Explore stunning imagery. Find your next idea.' : 'The images you love, collected in one beautiful place.'}</p>
          </div>
          <div className="source-pill"><span className="live-indicator"/> {view === 'explore' ? (source === 'all' ? `${8 + Number(hasEuropeanaKey()) + Number(hasWebImageEndpoint())} image sources` : source === 'openverse' ? 'Openverse' : source === 'commons' ? 'Wikimedia Commons' : source === 'nasa' ? 'NASA Images' : source === 'cleveland' ? 'Cleveland Museum of Art' : source === 'met' ? 'The Met' : source === 'europeana' ? 'Europeana' : source === 'wikipedia' ? 'Wikipedia' : source === 'artic' ? 'Art Institute of Chicago' : source === 'web' ? 'Web images' : 'Library of Congress') : `${saved.length} saved images`}</div>
        </div>

        {view === 'explore' &&
          <div className="topics" role="group" aria-label="Suggested searches">
            <span className="topics-label">DISCOVER</span>
            {TOPICS.map((topic) => <button type="button" className={query.toLowerCase() === topic.toLowerCase() ? 'topic active' : 'topic'} key={topic} onClick={() => chooseTopic(topic)}>{topic}</button>)}
          </div>
        }

        <div className="results-toolbar">
          <div className="results-title">
            <h2>{view === 'saved' ? 'Saved collection' : query.trim() ? `Results for “${query.trim()}”` : 'Explore images'}</h2>
            <span>{loading && view === 'explore' ? 'Searching…' : `${visible.length} images${view === 'explore' && hasMore ? ' · more to explore' : ''}`}</span>
          </div>
          <div className="toolbar-filters">
          <div className="filter-wrap source-filter"><label htmlFor="source">Source</label>
            <select id="source" value={source} onChange={(event) => { setSource(event.target.value as ImageSource); setOrientation('all') }}>
              <option value="all">All sources</option>
              <option value="openverse">Openverse</option>
              <option value="commons">Wikimedia Commons</option>
              <option value="loc">Library of Congress</option>
              <option value="nasa">NASA Images</option>
              <option value="cleveland">Cleveland Museum of Art</option>
              <option value="met">The Metropolitan Museum of Art</option>
              <option value="wikipedia">Wikipedia articles</option>
              <option value="artic">Art Institute of Chicago</option>
              <option value="europeana">Europeana (API key)</option>
              <option value="web" disabled={!hasWebImageEndpoint()}>Web images {hasWebImageEndpoint() ? "(SearXNG)" : "(connect in Settings)"}</option>
            </select>
          </div>
          <div className="filter-wrap"><SlidersHorizontal size={16}/>
            <label htmlFor="orientation">Orientation</label>
            <select id="orientation" value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}>
              {ORIENTATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          </div>
        </div>

        {storageError && <div className="message-bar" role="status">Saved images could not be persisted on this device. Check available storage or browser privacy settings.</div>}

        {error && view === 'explore' && <div className="error-panel" role="alert"><span>We couldn't load the images.</span><p>{error}</p><button type="button" onClick={() => setRefresh((n) => n + 1)}><RotateCcw size={16}/> Try again</button></div>}

        {(loading && view === 'explore') ? <div className="masonry skeleton-grid" aria-label="Loading images">
          {Array.from({length: 20}, (_, i) => <div key={i} className="skeleton" style={{aspectRatio: String([0.72, 1.25, 0.86, 1.05, 0.65][i % 5])}} />)}
        </div> : visible.length > 0 ? <div className="masonry">
          {visible.map((item) => <ImageTile key={item.id} item={item} isSaved={isSaved(item.id)}
            onOpen={() => setDetailId(item.id)}
            onDownload={() => void startImageDownload(item)}
            isDownloading={downloadingId === item.id}
            downloadBusy={downloadingId !== null}
            onToggleSaved={() => { toggleSaved(item); setToast(isSaved(item.id) ? 'Removed from saved' : 'Added to saved') }}/>)}
        </div> : !error && <div className="empty-panel">
          <div className="empty-icon"><Images size={30}/></div>
          <h3>{view === 'saved' ? 'Your collection starts here.' : 'No images found.'}</h3>
          <p>{view === 'saved' ? 'Save images while browsing and they will appear here.' : 'Try another search or change the orientation filter.'}</p>
          <button type="button" onClick={() => { if (view === 'saved') setView('explore'); else setOrientation('all') }}>{view === 'saved' ? 'Explore images' : 'Show all images'}</button>
        </div>}

        <div ref={sentinel} className="scroll-sentinel" />
        {view === 'explore' && loadMoreError && <div className="more-error" role="alert">
          <span>Couldn't load the next page. {loadMoreError}</span>
          <button type="button" onClick={() => void loadMore()}><RotateCcw size={15}/> Retry</button>
        </div>}
        {view === 'explore' && !loading && !error && hasMore && <div className="load-row">
          <button type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Finding more images…' : 'Explore more'} <ArrowDown size={16} /></button>
        </div>}
        <footer className="page-footer"><span>Image Search <span className="footer-dot">✦</span> Made with care by GoreeCloud</span><span>Images belong to their respective creators. Check licensing before reuse.</span></footer>
        </>}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button type="button" className={view === 'explore' ? 'selected' : ''} onClick={() => setView('explore')}><Compass size={21}/><span>Explore</span></button>
        <button type="button" className={view === 'saved' ? 'selected' : ''} onClick={() => setView('saved')}><Bookmark size={21}/><span>Saved</span></button>
        <button type="button" className={view === 'settings' ? 'selected' : ''} onClick={() => setView('settings')}><Settings2 size={21}/><span>Settings</span></button>
      </nav>

      {selected && <ImageDetail image={selected} isSaved={isSaved(selected.id)} onClose={closeDetail} onNext={nextDetail} onPrevious={previousDetail}
        onToggleSaved={() => { toggleSaved(selected); setToast(isSaved(selected.id) ? 'Removed from saved' : 'Added to saved') }}
        onCopy={() => void copyImageUrl(selected.url)}
        onDownload={() => void startImageDownload(selected)}
        isDownloading={downloadingId === selected.id}
        downloadBusy={downloadingId !== null} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
