import { BrowserRouter } from "react-router-dom"

import { TopProgressBar } from "@/components/loading/TopProgressBar"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/contexts/AuthContext"
import { AppRoutes } from "@/routes/AppRoutes"

import "@/lib/i18n"

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <TopProgressBar />
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
