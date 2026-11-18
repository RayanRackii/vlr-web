import { cadastroPassoFromLegacy, type CadastroStep } from "@/features/assistant/useCadastroStep"

/** The read-only "Ver produto" page. */
export function productViewPath(productId: string): string {
  return `/catalogo/produtos/${encodeURIComponent(productId)}`
}

/** Edit an existing product through the wizard (`modo=editar`), optionally opening a given step. */
export function productEditPath(productId: string, step?: CadastroStep | null): string {
  const base = `${productViewPath(productId)}/cadastro?modo=editar`
  return step && step !== "dados" ? `${base}&passo=${step}` : base
}

/** Maps an old `?aba=` editor tab onto the wizard step that now holds it. `history` has no step (the view has a Histórico tab). */
export function productEditStepFromLegacyTab(tab: string | null | undefined): CadastroStep | null {
  switch (tab) {
    case "access": return "regras"
    case "files": return "arquivos"
    case "agenda": return "agenda"
    case "price": return "precos"
    default: return null
  }
}

/** Maps an old assistant/wizard `passo` onto the wizard step (keeps the step ids and the legacy aliases). */
export function productEditStepFromLegacyPasso(step: string | null | undefined): CadastroStep | null {
  return cadastroPassoFromLegacy(step, "produtos")
}
