import { describe, expect, it } from "vitest"

import { deliveryErrorText } from "@/features/catalog/lib/deliveryErrorMessage"
import i18n from "@/lib/i18n"

function translate(lng: string) {
  return (key: string, options?: Record<string, string>) => i18n.t(key, { ...options, lng })
}

describe("deliveryErrorText", () => {
  it.each([
    ["pt-BR", "Destinatário sem WhatsApp cadastrado"],
    ["en", "No WhatsApp number on file."],
    ["es", "Destinatario sin WhatsApp registrado."],
  ])("translates a missing WhatsApp recipient in %s", (lng, expected) => {
    expect(deliveryErrorText("WhatsApp recipient is missing.", translate(lng))).toBe(expected)
  })

  it("translates the other known delivery failures", () => {
    const t = translate("pt-BR")
    expect(deliveryErrorText("Email recipient is missing.", t)).toBe("Destinatário sem e-mail cadastrado.")
    expect(deliveryErrorText("SMS channel is not available.", t)).toBe("O canal SMS não está disponível.")
    expect(deliveryErrorText("Channel has no external provider.", t)).toBe("Este canal não tem envio externo.")
    expect(deliveryErrorText("Unsupported channel Push.", t)).toBe("Canal Push não é suportado.")
  })

  it("keeps an unknown message as the API sent it", () => {
    expect(deliveryErrorText("Provider timed out.", translate("pt-BR"))).toBe("Provider timed out.")
    expect(deliveryErrorText("  ", translate("en"))).toBeNull()
  })
})