import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

import i18n from "@/lib/i18n"

await i18n.changeLanguage("pt-BR")

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: null },
        error: null,
      })),
      getUser: vi.fn(async () => ({
        data: { user: null },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => ({ error: null })),
      refreshSession: vi.fn(async () => ({ error: null })),
    },
  },
}))

afterEach(() => {
  cleanup()
})
