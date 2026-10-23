import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { readTheme } from './hooks/useThemeMode'

// Apply the saved preference before React paints; new profiles use the light mockup.
document.documentElement.dataset.theme = readTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
