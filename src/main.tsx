import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/space-grotesk/index.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import App from './App'
import './refresh.css'
import './polish.css'
import { applyTheme, savedTheme } from './data/theme'

applyTheme(savedTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
