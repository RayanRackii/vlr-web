import { createClient } from "@supabase/supabase-js"
import { noteSignInStarted, staffAuthStorage } from "@/lib/signOutMarker"

function resolveSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    throw new Error(
      "Missing VITE_SUPABASE_URL. Add it to frontend/.env and restart the dev server.",
    )
  }

  return rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "")
}

const supabaseUrl = resolveSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_ANON_KEY. Add it to frontend/.env and restart the dev server.",
  )
}

// The SDK consumes legacy recovery hashes during construction, before the page mounts.
const hash = new URLSearchParams(window.location.hash.slice(1))
if (
  window.location.pathname === "/reset-password" &&
  hash.get("type") === "recovery" &&
  hash.get("access_token") &&
  hash.get("refresh_token")
) {
  noteSignInStarted()
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: staffAuthStorage,
    // Leave debug off. The library logger can print access and refresh tokens.
    debug: false,
  },
})
