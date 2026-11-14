import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

import { resetCurrentUserCacheForTests } from "@/features/users/services/currentUserCache"
import i18n from "@/lib/i18n"
import enCommon from "@/locales/en/common.json"
import { enPermissionCopy } from "@/locales/en/permissionCopy"
import esCommon from "@/locales/es/common.json"
import { esPermissionCopy } from "@/locales/es/permissionCopy"
import { mergePermissionCopy, registerLanguageBundle } from "@/lib/localeBundles"

// Production loads en/es lazily; tests keep every locale available synchronously.
registerLanguageBundle(i18n, "en", mergePermissionCopy(enCommon, enPermissionCopy))
registerLanguageBundle(i18n, "es", mergePermissionCopy(esCommon, esPermissionCopy))

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
      stopAutoRefresh: vi.fn(async () => undefined),
      startAutoRefresh: vi.fn(async () => undefined),
      admin: { signOut: vi.fn(async () => ({ data: null, error: null })) },
      refreshSession: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(async () => ({
        data: { user: null, session: null },
        error: null,
      })),
      verifyOtp: vi.fn(async () => ({
        data: { session: null, user: null },
        error: null,
      })),
      updateUser: vi.fn(async () => ({
        data: { user: null },
        error: null,
      })),
    },
  },
}))

afterEach(() => {
  resetCurrentUserCacheForTests()
  localStorage.clear()
  cleanup()
})
