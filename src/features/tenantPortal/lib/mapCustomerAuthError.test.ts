import { describe, expect, it } from "vitest"

import {
  localizeCustomerAuthError,
  parseCustomerAuthError,
} from "@/features/tenantPortal/lib/mapCustomerAuthError"

describe("mapCustomerAuthError", () => {
  it("maps known login failures to Portuguese copy", () => {
    expect(localizeCustomerAuthError("Invalid email or password.")).toBe(
      "E-mail ou senha inválidos.",
    )
  })

  it("maps email-not-verified without exposing the raw API sentence", () => {
    expect(
      localizeCustomerAuthError(
        "Email is not verified. Complete email verification first.",
      ),
    ).toBe("Confirme seu e-mail antes de entrar.")
  })

  it("keeps unknown server errors", () => {
    expect(localizeCustomerAuthError("Upstream timeout from mailer.")).toBe(
      "Upstream timeout from mailer.",
    )
  })

  it("falls back when the payload has no error string", () => {
    expect(parseCustomerAuthError({ status: 500 }, "Não foi possível entrar.")).toBe(
      "Não foi possível entrar.",
    )
  })

  it("maps a known error payload from parseApiError", () => {
    expect(
      parseCustomerAuthError(
        { error: "Invalid email or password." },
        "Não foi possível entrar.",
      ),
    ).toBe("E-mail ou senha inválidos.")
  })
})
