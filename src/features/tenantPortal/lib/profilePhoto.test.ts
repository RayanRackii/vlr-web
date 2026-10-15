import { describe, expect, it, vi } from "vitest"

import { resolveCustomerPhotoUrl } from "@/features/tenantPortal/lib/profilePhoto"

const SIGNUP_PHOTO = `data:image/jpeg;base64,${"a".repeat(48)}`

describe("resolveCustomerPhotoUrl", () => {
  it("prefers the photoUrl column", () => {
    const column = `data:image/jpeg;base64,${"b".repeat(48)}`
    expect(
      resolveCustomerPhotoUrl(column, { fotoDePerfil: SIGNUP_PHOTO }),
    ).toBe(column)
  })

  it("reads the signup photo from extraAttributes.fotoDePerfil when photoUrl is null", () => {
    expect(
      resolveCustomerPhotoUrl(null, {
        cep: "85851000",
        fotoDePerfil: SIGNUP_PHOTO,
      }),
    ).toBe(SIGNUP_PHOTO)
  })

  it("accepts photo, photoUrl, and a data URL on another key", () => {
    expect(resolveCustomerPhotoUrl("  ", { photo: SIGNUP_PHOTO })).toBe(
      SIGNUP_PHOTO,
    )
    expect(
      resolveCustomerPhotoUrl(null, {
        photoUrl: "https://cdn.example.com/profiles/photo.jpg",
      }),
    ).toBe("https://cdn.example.com/profiles/photo.jpg")
    expect(
      resolveCustomerPhotoUrl(null, { avatar: SIGNUP_PHOTO }),
    ).toBe(SIGNUP_PHOTO)
  })

  it("ignores short values and non-image extras", () => {
    expect(
      resolveCustomerPhotoUrl(null, {
        cep: "85851000",
        site: "https://club.example",
        fotoDePerfil: "too-short",
      }),
    ).toBeNull()
    expect(resolveCustomerPhotoUrl(null, null)).toBeNull()
  })

  it("does not log the photo payload", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    resolveCustomerPhotoUrl(null, { fotoDePerfil: SIGNUP_PHOTO })
    expect(log).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
    log.mockRestore()
    info.mockRestore()
  })
})
