import { expect, it } from "vitest"

import { cadastroPassoFromLegacy } from "@/features/assistant/useCadastroStep"

it("maps each wizard step onto the cadastro step that holds it", () => {
  expect(cadastroPassoFromLegacy("access", "produtos")).toBe("regras")
  expect(cadastroPassoFromLegacy("resource", "produtos")).toBe("agenda")
  expect(cadastroPassoFromLegacy("offer", "produtos")).toBe("precos")
  expect(cadastroPassoFromLegacy("rules", "produtos")).toBeNull()
  expect(cadastroPassoFromLegacy("rules", "recursos")).toBe("agenda")
  expect(cadastroPassoFromLegacy("prices", "recursos")).toBe("precos")
  expect(cadastroPassoFromLegacy("access", "recursos")).toBeNull()
  expect(cadastroPassoFromLegacy("regras", "recursos")).toBe("regras")
  expect(cadastroPassoFromLegacy("agenda", "produtos")).toBe("agenda")
  expect(cadastroPassoFromLegacy("dados", "produtos")).toBeNull()
})
