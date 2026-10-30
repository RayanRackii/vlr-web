import { describe, expect, it } from "vitest"

import {
  customerDuplicateField,
  localizeCustomerAuthError,
  parseCustomerAuthError,
  parseCustomerAuthErrorField,
} from "@/features/tenantPortal/lib/mapCustomerAuthError"

describe("mapCustomerAuthError", () => {
  it("maps known login failures to Portuguese copy", () => {
    expect(localizeCustomerAuthError("Invalid email or password.")).toBe(
      "E-mail ou senha inválidos.",
    )
  })

  it("maps password reset failures to Portuguese copy", () => {
    expect(
      localizeCustomerAuthError(
        "Too many verification attempts. Try again shortly.",
      ),
    ).toBe("Muitas tentativas. Tente de novo em instantes.")
    expect(
      localizeCustomerAuthError("Password must be at least 8 characters."),
    ).toBe("A senha deve ter no mínimo 8 caracteres.")
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

  it("names the email field when the backend flags a duplicate e-mail", () => {
    expect(
      localizeCustomerAuthError("A customer with this email already exists."),
    ).toBe("Já existe uma conta com este e-mail.")
    expect(
      customerDuplicateField("A customer with this email already exists."),
    ).toBe("email")
  })

  it("names the document field for a duplicate CPF or document", () => {
    expect(
      localizeCustomerAuthError(
        "A customer with this document already exists.",
      ),
    ).toBe("Já existe uma conta com este CPF/CNPJ.")
    expect(
      customerDuplicateField("A customer with this document already exists."),
    ).toBe("document")
    expect(
      customerDuplicateField("A customer with this CPF already exists."),
    ).toBe("document")
  })

  it("names the phone field for a duplicate phone", () => {
    expect(
      localizeCustomerAuthError("A customer with this phone already exists."),
    ).toBe("Já existe uma conta com este telefone.")
    expect(
      customerDuplicateField("A customer with this phone already exists."),
    ).toBe("phone")
  })

  it("has no specific field when the backend cannot narrow the duplicate down", () => {
    expect(
      customerDuplicateField(
        "A customer with the same email, document, or phone already exists.",
      ),
    ).toBeNull()
    expect(
      parseCustomerAuthErrorField({
        error:
          "A customer with the same email, document, or phone already exists.",
      }),
    ).toBeNull()
  })

  it("resolves a duplicate field from the raw API payload", () => {
    expect(
      parseCustomerAuthErrorField({
        error: "A customer with this email already exists.",
      }),
    ).toBe("email")
    expect(parseCustomerAuthErrorField({ status: 500 })).toBeNull()
  })
})
