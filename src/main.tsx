import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { appIcons } from './assets/icons'
import './index.css'

function setFavicon(href: string, type: string, sizes?: string) {
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = type
  if (sizes) link.sizes = sizes
  link.href = href
  document.head.appendChild(link)
}

setFavicon(appIcons.png32, 'image/png', '32x32')
setFavicon(appIcons.svg, 'image/svg+xml')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
