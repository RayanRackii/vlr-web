import { createBrowserRouter, RouterProvider } from "react-router-dom"

import { TopProgressBar } from "@/components/loading/TopProgressBar"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/contexts/AuthContext"
import { AppRoutes } from "@/routes/AppRoutes"

import "@/lib/i18n"

// A data router (createBrowserRouter) is required for useBlocker-based unsaved
// changes guards (see EntityPage). A single splat route hosts the existing
// descendant <Routes> tree, so no route definitions move.
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <>
        <TopProgressBar />
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </>
    ),
  },
])

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
