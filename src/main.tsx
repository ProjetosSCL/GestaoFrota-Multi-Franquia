import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from '@/App'
import { AuthProvider } from '@/contexts/AuthContext'
import { supabaseConfigured } from '@/lib/supabase'
import { SetupRequiredPage } from '@/pages/SetupRequired'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {supabaseConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <SetupRequiredPage />
    )}
  </React.StrictMode>,
)
