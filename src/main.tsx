import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/space-grotesk/index.css'
import '@fontsource-variable/fraunces/index.css'
import '@fontsource-variable/geist/index.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import App from './App'
import './refresh.css'
import './polish.css'
import './looks.css'
import './sleek.css'
import { applyTheme, savedTheme } from './data/theme'
import { startLook } from './data/appearance'

applyTheme(savedTheme())
startLook()

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
