import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ionConfig } from './lib/ionConfig'
import { installCredentialLogRedaction } from './lib/credentialLogs'

installCredentialLogRedaction(ionConfig.token)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
