import { createClient } from "@supabase/supabase-js"

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
