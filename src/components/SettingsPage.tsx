import { FormEvent, useState } from 'react'
import { KeyRound, LockKeyhole, Moon, Sun, Unplug, ExternalLink } from 'lucide-react'
import { hasEuropeanaKey, setEuropeanaKey } from '../services/apiKeys'
import type { ThemeMode } from '../hooks/useThemeMode'

type Props = {
  theme: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  onApiChange: () => void
}

export function SettingsPage({ theme, onThemeChange, onApiChange }: Props) {
  const [keyDraft, setKeyDraft] = useState('')
  const [configured, setConfigured] = useState(hasEuropeanaKey())
  const [notice, setNotice] = useState('')

  function updateKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setEuropeanaKey(keyDraft)
      setConfigured(hasEuropeanaKey())
      setKeyDraft('')
      setNotice(hasEuropeanaKey() ? 'Europeana key configured for this session; search to verify access.' : 'Europeana disabled.')
      onApiChange()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not set API key.')
    }
  }

  function disconnect() {
    setEuropeanaKey('')
    setKeyDraft('')
    setConfigured(false)
    setNotice('Europeana disconnected from this session.')
    onApiChange()
  }


  return (
    <section className="settings-page" aria-label="Image Search settings">
      <div className="settings-heading">
        <span className="eyebrow">PREFERENCES & CONNECTIONS</span>
        <h1>Settings</h1>
        <p>Make Image Search yours. Choose your appearance and connect optional image providers.</p>
      </div>
      <section className="settings-card" aria-labelledby="appearance-heading">
        <div className="settings-card-heading">
          <h2 id="appearance-heading">Appearance</h2>
          <p>Choose how Image Search looks on this device.</p>
        </div>
        <div className="settings-choice" role="group" aria-label="Theme">
          <button type="button" aria-pressed={theme === 'dark'} className={theme === 'dark' ? 'chosen' : ''} onClick={() => onThemeChange('dark')}><Moon size={19}/> Dark mode</button>
          <button type="button" aria-pressed={theme === 'light'} className={theme === 'light' ? 'chosen' : ''} onClick={() => onThemeChange('light')}><Sun size={19}/> Light mode</button>
        </div>
      </section>
      <section className="settings-card" id="api-settings" aria-labelledby="api-heading">
        <div className="settings-card-heading">
          <h2 id="api-heading"><KeyRound size={19}/> API</h2>
          <p>GoreeCloud Search images are built in. Optional heritage providers can be connected separately.</p>
        </div>
        <div className="provider-row">
          <div>
            <strong>Europeana Heritage</strong>
            <p>Search European cultural heritage imagery with your own Europeana API key.</p>
            <a href="https://www.europeana.eu/en/how-to-register-for-and-manage-an-api-key" target="_blank" rel="noopener noreferrer">Get a key from Europeana <ExternalLink size={13}/></a>
          </div>
          <span className="provider-status">{configured ? 'Configured for this session' : 'Not connected'}</span>
        </div>
        <form className="api-form" onSubmit={updateKey}>
          <label htmlFor="europeana-api-key">Europeana API key</label>
          <div className="api-form-fields">
            <input id="europeana-api-key" type="password" autoComplete="off" maxLength={256} spellCheck={false}
              placeholder={configured ? 'Enter a replacement key' : 'Paste your Europeana API key'}
              value={keyDraft} onChange={event => setKeyDraft(event.target.value)}
              aria-describedby="api-privacy"/>
            <button type="submit" disabled={!keyDraft.trim()}>Connect</button>
            {configured && <button type="button" className="disconnect" onClick={disconnect}><Unplug size={16}/> Remove</button>}
          </div>
        </form>
        {notice && <p role="status" className="api-notice">{notice}</p>}
        <p className="api-privacy" id="api-privacy"><LockKeyhole size={15}/> Keys stay in this app session's memory and are not saved to disk or included in image URLs. The key is sent only to the chosen provider as an X-Api-Key header. Use a personal key only for personal exploration; services require provider-approved project keys. Closing or reloading the app clears it. Use a provider-issued key intended for client applications; never paste private server secrets.</p>
        <div className="provider-row">
          <div>
            <strong>GoreeCloud Search · General-web images</strong>
            <p>Built into Image Search and included in every All sources search. Powered by GoreeCloud's SearXNG-based search backend; no third-party server address or personal API key is required. Coverage depends on the GoreeCloud Search service and its available image engines.</p>
          </div>
          <span className="provider-status">Enabled by default</span>
        </div>
        <p className="api-privacy"><LockKeyhole size={15}/> Search terms are sent to the first-party GoreeCloud Search endpoint when available. Image thumbnails can load from their originating websites. Copyright restrictions may apply; the image grid displays a copyright caution for images without verified public-domain rights. If GoreeCloud Search is unavailable, the free image collections still work.</p>
        <p className="api-privacy">Connected providers are included in “All sources.” If a provider fails or reaches its API limit, the other sources remain usable.</p>
      </section>
    </section>
  )
}
