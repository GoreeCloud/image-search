import { FormEvent, useState } from 'react'
import { KeyRound, LockKeyhole, Moon, Sun, Unplug, ExternalLink } from 'lucide-react'
import { hasPexelsKey, setPexelsKey } from '../services/apiKeys'
import type { ThemeMode } from '../hooks/useThemeMode'

type Props = {
  theme: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  onApiChange: () => void
}

export function SettingsPage({ theme, onThemeChange, onApiChange }: Props) {
  const [keyDraft, setKeyDraft] = useState('')
  const [configured, setConfigured] = useState(hasPexelsKey())
  const [notice, setNotice] = useState('')

  function updateKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setPexelsKey(keyDraft)
      setConfigured(hasPexelsKey())
      setKeyDraft('')
      setNotice(hasPexelsKey() ? 'Pexels enabled for this session.' : 'Pexels disabled.')
      onApiChange()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not set API key.')
    }
  }

  function disconnect() {
    setPexelsKey('')
    setKeyDraft('')
    setConfigured(false)
    setNotice('Pexels disconnected from this session.')
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
          <p>Connect optional image services. Free public collections work without keys.</p>
        </div>
        <div className="provider-row">
          <div>
            <strong>Pexels Photos</strong>
            <p>Browse additional photography with your own Pexels API key.</p>
            <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer">Get a key from Pexels <ExternalLink size={13}/></a>
          </div>
          <span className="provider-status">{configured ? 'Connected for this session' : 'Not connected'}</span>
        </div>
        <form className="api-form" onSubmit={updateKey}>
          <label htmlFor="pexels-api-key">Pexels API key</label>
          <div className="api-form-fields">
            <input id="pexels-api-key" type="password" autoComplete="off" spellCheck={false}
              placeholder={configured ? 'Enter a replacement key' : 'Paste your Pexels API key'}
              value={keyDraft} onChange={event => setKeyDraft(event.target.value)}
              aria-describedby="api-privacy"/>
            <button type="submit" disabled={!keyDraft.trim()}>Connect</button>
            {configured && <button type="button" className="disconnect" onClick={disconnect}><Unplug size={16}/> Remove</button>}
          </div>
        </form>
        {notice && <p role="status" className="api-notice">{notice}</p>}
        <p className="api-privacy" id="api-privacy"><LockKeyhole size={15}/> Keys stay in this app session's memory and are not saved to disk or included in image URLs. The key is sent only to the chosen provider. Closing or reloading the app clears it. Use a provider-issued key intended for client applications; never paste private server secrets.</p>
        <p className="api-privacy">Connected providers are included in “All sources.” If a provider fails or reaches its API limit, the other sources remain usable.</p>
      </section>
    </section>
  )
}
