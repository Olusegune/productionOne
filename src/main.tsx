import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/geist/index.css'
import '@fontsource-variable/geist-mono/index.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import App from './App'
import './refresh.css'
import './polish.css'
import './looks.css'
import './sleek.css'
import './refine.css'
import './finish.css'
import './strip.css'
import './start.css'
import { applyTheme, savedTheme } from './data/theme'
import { startRangeFill } from './data/rangeFill'
import { startLook } from './data/appearance'

applyTheme(savedTheme())
startRangeFill()
startLook()

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
