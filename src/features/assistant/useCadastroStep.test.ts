import { expect, it } from "vitest"

import { cadastroArea, cadastroPassoFromLegacy, isCadastroFocusPath } from "@/features/assistant/useCadastroStep"

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

it("uses the focus layout only on the cadastro routes that render the shell", () => {
  for (const path of ["/catalogo/produtos/cadastro", "/catalogo/produtos/p1/cadastro", "/catalogo/produtos/p1/cadastro/", "/configuracoes/recursos/r1/cadastro"]) {
    expect(isCadastroFocusPath(path)).toBe(true)
  }
  for (const path of ["/catalogo/produtos", "/catalogo/produtos/p1", "/configuracoes/recursos/cadastro", "/configuracoes/recursos", "/dashboard", "/catalogo/produtos/p1/cadastro/x"]) {
    expect(isCadastroFocusPath(path)).toBe(false)
  }
  expect(cadastroArea("/catalogo/produtos/p1/cadastro")).toBe("produtos")
  expect(cadastroArea("/configuracoes/recursos/r1/cadastro")).toBe("recursos")
})
