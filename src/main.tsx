// Initialize the persisted sign-out barrier before the app loads the auth client.
import '@/lib/signOutMarker'
import { StrictMode } from 'react'
import { LucideProvider } from 'lucide-react'
import { ICON_STROKE_WIDTH } from '@/lib/icon'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AppErrorBoundary } from '@/components/layout/AppErrorBoundary'
import App from './App.tsx'
import { i18nReady } from '@/lib/i18n'
import { installSessionRestoreGuard } from '@/lib/sessionRestoreGuard'

installSessionRestoreGuard()

// Wait for the saved language's bundle so the first paint has no raw keys or flash.
// The app must still render if locale init fails.
void i18nReady
  .catch(() => undefined)
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <LucideProvider strokeWidth={ICON_STROKE_WIDTH} className="shrink-0">
          <AppErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <App />
            </QueryClientProvider>
          </AppErrorBoundary>
        </LucideProvider>
      </StrictMode>,
    )
  })
