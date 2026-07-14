import { BrowserRouter } from "react-router-dom"

import { ThemeProvider } from "@/components/ThemeProvider"
import { AuthProvider } from "@/contexts/AuthContext"
import { AppRoutes } from "@/routes/AppRoutes"

import "@/lib/i18n"

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
