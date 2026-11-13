import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/inter'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import App from './App'
import './refresh.css'
import './polish.css'
import { applyTheme, savedTheme } from './data/theme'

applyTheme(savedTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
