import { BrowserRouter } from "react-router-dom"

import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/contexts/AuthContext"
import { SupportTenantProvider } from "@/features/admin/support/SupportTenantProvider"
import { AppRoutes } from "@/routes/AppRoutes"

import "@/lib/i18n"

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SupportTenantProvider>
            <AppRoutes />
            <Toaster />
          </SupportTenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
