import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Bookmark, ChevronDown, Compass, Images, Search, SlidersHorizontal, X, RotateCcw, Settings2 } from 'lucide-react'
import { ImageTile } from './components/ImageTile'
import { ImageDetail } from './components/ImageDetail'
import { SettingsPage } from './components/SettingsPage'
import { useThemeMode } from './hooks/useThemeMode'
import { hasEuropeanaKey } from './services/apiKeys'
import { isModernTechnologyQuery } from './services/relevance'
import { downloadOriginalImage, isNativeAndroidDownload } from './services/downloadImage'
import './styles.css'
import './settings.css'
import './discovery.css'
import { useImageSearch } from './hooks/useImageSearch'
import { useSavedImages } from './hooks/useSavedImages'
import { useSoftwareKeyboard } from './hooks/useSoftwareKeyboard'
import type { ImageSource, SingleSource } from './services/providers'
import type { ImageResult } from './types'

const TOPICS = [
  { label: 'All images', query: '' },
  { label: 'Nature', query: 'nature' },
  { label: 'Design', query: 'design architecture' },
  { label: 'Space', query: 'space nebula galaxy' },
  { label: 'Travel', query: 'travel destinations' },
]
const SOURCE_LABELS: Record<SingleSource, string> = {
  openverse: 'Openverse', commons: 'Wikimedia Commons', loc: 'Library of Congress',
  nasa: 'NASA', cleveland: 'Cleveland Museum of Art', met: 'The Met', europeana: 'Europeana',
  wellcome: 'Wellcome Collection', vam: 'Victoria and Albert Museum',
}
type View = 'explore' | 'saved' | 'settings'
type Orientation = 'all' | 'landscape' | 'portrait' | 'square'
const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: 'all', label: 'All images' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'square', label: 'Square' },
]
const IMAGE_BATCH_SIZE = 48

function isOrientation(image: ImageResult, orientation: Orientation) {
  if (orientation !== 'all' && image.dimensionsKnown === false) return false
  const ratio = image.width / image.height
  return orientation === 'all'
    || (orientation === 'landscape' && ratio > 1.2)
    || (orientation === 'portrait' && ratio < 0.83)
    || (orientation === 'square' && ratio >= 0.83 && ratio <= 1.2)
}

export default function App() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [activeTopic, setActiveTopic] = useState<string | null>('All images')
  const [view, setView] = useState<View>('explore')
  const [orientation, setOrientation] = useState<Orientation>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [source, setSource] = useState<ImageSource>('all')
  const [displayLimit, setDisplayLimit] = useState(IMAGE_BATCH_SIZE)
  const keyboardOpen = useSoftwareKeyboard()
  const [theme, setTheme] = useThemeMode()
  const searchRef = useRef<HTMLInputElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const { images, loading, loadingMore, error, loadMoreError, unavailableSources, hasMore, loadMore } = useImageSearch(query, refresh, source)
  const collectionLimitedQuery = source === 'all' && isModernTechnologyQuery(query)
  const { saved, isSaved, toggleSaved, storageError } = useSavedImages()
  const visible = useMemo(() => (view === 'saved' ? saved : images).filter((item) => isOrientation(item, orientation)), [view, saved, images, orientation])
  const moreToReveal = view === 'explore' && visible.length > displayLimit
  const displayed = view === 'explore' ? visible.slice(0, displayLimit) : visible
  const currentIndex = displayed.findIndex((item) => item.id === detailId)
  const selected = currentIndex >= 0 ? displayed[currentIndex] : null

  useEffect(() => setDisplayLimit(IMAGE_BATCH_SIZE), [query, refresh, source, orientation])

  const showMore = useCallback(() => {
    if (moreToReveal) setDisplayLimit((current) => current + IMAGE_BATCH_SIZE)
    else void loadMore()
  }, [moreToReveal, loadMore])

  useEffect(() => {
    const node = sentinel.current
    // If providers are down, pause background pagination. Only an explicit
    // click on Explore more should retry the failed sources.
    if (!node || view !== 'explore' || loading || !('IntersectionObserver' in window)) return
    // Reveal already fetched items before requesting another provider page.
    // A failed provider must not hide images that have already loaded.
    if (!moreToReveal && (!hasMore || error || loadMoreError || unavailableSources.length)) return
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) showMore() }, { rootMargin: '800px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [showMore, moreToReveal, view, hasMore, error, loadMoreError, loading, unavailableSources])

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
    setActiveTopic(null)
    setOrientation('all')
    setQuery(next)
    if (query === next) setRefresh((n) => n + 1)
    setDetailId(null)
    searchRef.current?.blur()
  }

  function chooseTopic(topic: (typeof TOPICS)[number]) {
    setInput('')
    setQuery(topic.query)
    setActiveTopic(topic.label)
    setView('explore')
    setOrientation('all')
    setDetailId(null)
    if (query === topic.query) setRefresh((n) => n + 1)
  }

  function onApiChange() {
    if (source === 'europeana' && !hasEuropeanaKey()) setSource('all')
    setRefresh(n => n + 1)
  }

  const closeDetail = useCallback(() => setDetailId(null), [])
  const nextDetail = useCallback(() => {
    setDetailId((id) => {
      const index = displayed.findIndex((item) => item.id === id)
      return displayed.length ? displayed[(index + 1) % displayed.length].id : null
    })
  }, [displayed])
  const previousDetail = useCallback(() => {
    setDetailId((id) => {
      const index = displayed.findIndex((item) => item.id === id)
      return displayed.length ? displayed[(index - 1 + displayed.length) % displayed.length].id : null
    })
  }, [displayed])

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
          <button type="button" className="brand" onClick={() => { setView('explore'); setInput(''); setQuery(''); setActiveTopic('All images'); setSource('all'); setOrientation('all'); setDetailId(null) }} aria-label="GoreeCloud Image Search home">
            <span className="brand-mark"><img src="/app-icon.svg" alt="" /></span>
            <span className="brand-name"><small>GoreeCloud</small><strong>Image Search</strong></span>
          </button>
          <nav className="topnav" aria-label="Main navigation">
            <button type="button" className={`nav-link ${view === 'explore' ? 'selected' : ''}`} onClick={() => setView('explore')}><Compass size={18}/><span>Explore</span></button>
            <button type="button" className={`nav-link ${view === 'saved' ? 'selected' : ''}`} onClick={() => setView('saved')}><Bookmark size={18}/><span>Saved</span>{saved.length > 0 && <em>{saved.length}</em>}</button>
            <button type="button" className={`nav-link ${view === 'settings' ? 'selected' : ''}`} onClick={() => setView('settings')} aria-label="Settings"><Settings2 size={18}/><span>Settings</span></button>
          </nav>
        </div>
      </header>

      <main className="page-main">
        {view === 'settings' ? <SettingsPage theme={theme} onThemeChange={setTheme} onApiChange={onApiChange}/> : <>
        <section className="discovery-hero" aria-label="Visual discovery">
          <div className="headline-row">
            <h1>{view === 'explore' ? <>Discover something <em>wonderful.</em></> : <>Your saved <em>wonders.</em></>}</h1>
          </div>
          {view === 'explore' && <>
            <div className="hero-search-row">
              <form className="search-form" role="search" onSubmit={submitSearch}>
                <Search size={23} className="search-icon" aria-hidden="true" />
                <input ref={searchRef} autoComplete="off" enterKeyHint="search" aria-label="Search images" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Search images, ideas, places..." maxLength={180} />
                {input && <button className="clear-search" onClick={() => { setInput(''); searchRef.current?.focus() }} type="button" aria-label="Clear search"><X size={17} /></button>}
                <button className="search-submit" type="submit" aria-label="Search images"><Search size={20}/><span>Search</span></button>
              </form>
              <button type="button" className={`filter-trigger ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen((open) => !open)} aria-label="Search filters" aria-expanded={filtersOpen} aria-controls="image-filters"><SlidersHorizontal size={23}/></button>
            </div>
            {filtersOpen && <div id="image-filters" className="hero-filter-panel">
              <label htmlFor="orientation">Image orientation</label>
              <select id="orientation" value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}>
                {ORIENTATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <span>Choose a shape to narrow your results.</span>
            </div>}
            <div className="topics" role="group" aria-label="Explore categories">
              {TOPICS.map((topic) => <button type="button" className={activeTopic === topic.label ? 'topic active' : 'topic'} key={topic.label} onClick={() => chooseTopic(topic)} aria-pressed={activeTopic === topic.label}>{topic.label}</button>)}
            </div>
          </>}
        </section>

        <div className="results-toolbar">
          <div className="results-title">
            <h2>{view === 'saved' ? 'Saved' : activeTopic === 'All images' ? 'Explore' : activeTopic ? `Explore ${activeTopic.toLowerCase()}` : `Results for “${query.trim()}”`}</h2>
            <span>{loading && view === 'explore' ? 'Searching…' : `${displayed.length}${moreToReveal ? ` of ${visible.length}` : ''} images${view === 'explore' && (moreToReveal || hasMore) ? ' · more to explore' : ''}`}</span>
            {view === 'explore' && !loading && !error && (moreToReveal || hasMore) && <button type="button" className="quick-more" disabled={loadingMore && !moreToReveal} onClick={showMore}>
              {loadingMore && !moreToReveal ? 'Loading…' : 'Show more images'} <ArrowDown size={14} />
            </button>}
          </div>
          <div className="toolbar-filters">
          <div className="filter-wrap source-filter"><label htmlFor="source" className="sr-only">Image source</label>
            <select id="source" value={source} onChange={(event) => { setSource(event.target.value as ImageSource); setOrientation('all') }}>
              <option value="all">All sources</option>
              <option value="openverse">Openverse</option>
              <option value="commons">Wikimedia Commons</option>
              <option value="loc">Library of Congress</option>
              <option value="nasa">NASA Images</option>
              <option value="cleveland">Cleveland Museum of Art</option>
              <option value="met">The Metropolitan Museum of Art</option>
              <option value="wellcome">Wellcome Collection</option>
              <option value="vam">Victoria and Albert Museum</option>
              <option value="europeana">Europeana (API key)</option>
            </select>
            <ChevronDown size={19} aria-hidden="true" />
          </div>
          </div>
        </div>

        {storageError && <div className="message-bar" role="status">Saved images could not be persisted on this device. Check available storage or browser privacy settings.</div>}
        {view === 'explore' && !loading && unavailableSources.length > 0 && <div className="message-bar source-warning" role="status">
          <span>{unavailableSources.map(name => SOURCE_LABELS[name as SingleSource] || 'Image source').join(', ')} {unavailableSources.length === 1 ? 'is' : 'are'} temporarily unavailable. Results may be incomplete.</span>
          <button type="button" disabled={loadingMore} onClick={() => hasMore ? void loadMore() : setRefresh(n => n + 1)}><RotateCcw size={14}/> {loadingMore ? 'Retrying…' : 'Retry source'}</button>
        </div>}

        {error && view === 'explore' && <div className="error-panel" role="alert"><span>We couldn't load the images.</span><p>{error}</p><button type="button" onClick={() => setRefresh((n) => n + 1)}><RotateCcw size={16}/> Try again</button></div>}

        {(loading && view === 'explore') ? <div className="masonry skeleton-grid" aria-label="Loading images">
          {Array.from({length: 20}, (_, i) => <div key={i} className="skeleton" style={{aspectRatio: String([0.72, 1.25, 0.86, 1.05, 0.65][i % 5])}} />)}
        </div> : displayed.length > 0 ? <div className="masonry">
          {displayed.map((item) => <ImageTile key={item.id} item={item} isSaved={isSaved(item.id)}
            onOpen={() => setDetailId(item.id)}
            onDownload={() => void startImageDownload(item)}
            isDownloading={downloadingId === item.id}
            downloadBusy={downloadingId !== null}
            onRights={() => setDetailId(item.id)}
            onToggleSaved={() => { toggleSaved(item); setToast(isSaved(item.id) ? 'Removed from saved' : 'Added to saved') }}/>)}
        </div> : !error && <div className="empty-panel">
          <div className="empty-icon"><Images size={30}/></div>
          <h3>{view === 'saved' ? 'Your collection starts here.' : collectionLimitedQuery && images.length === 0 ? 'No matching screenshots yet.' : 'No images found.'}</h3>
          <p>{view === 'saved' ? 'Save images while browsing and they will appear here.' : collectionLimitedQuery && images.length === 0 ? 'Our image collections have limited coverage of current software interfaces. Try another phrase or select a specific source.' : 'Try another search or change the orientation filter.'}</p>
          <button type="button" onClick={() => { if (view === 'saved') setView('explore'); else if (collectionLimitedQuery && images.length === 0) searchRef.current?.focus(); else setOrientation('all') }}>{view === 'saved' ? 'Explore images' : collectionLimitedQuery && images.length === 0 ? 'Refine search' : 'Show all images'}</button>
        </div>}

        <div ref={sentinel} className="scroll-sentinel" />
        {view === 'explore' && loadMoreError && <div className="more-error" role="alert">
          <span>Couldn't load the next page. {loadMoreError}</span>
          <button type="button" onClick={() => void loadMore()}><RotateCcw size={15}/> Retry</button>
        </div>}
        {view === 'explore' && !loading && !error && (moreToReveal || hasMore) && <div className="load-row">
          <button type="button" disabled={loadingMore && !moreToReveal} onClick={showMore}>{loadingMore && !moreToReveal ? 'Finding more images…' : 'Explore more'} <ArrowDown size={16} /></button>
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
