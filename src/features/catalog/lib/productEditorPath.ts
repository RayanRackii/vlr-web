import { cadastroPassoFromLegacy } from "@/features/assistant/useCadastroStep"

export type ProductEditorTab = "dados" | "price" | "agenda" | "access" | "files" | "history"

const PRODUCT_EDITOR_TABS: readonly ProductEditorTab[] = ["dados", "price", "agenda", "access", "files", "history"]

export function isProductEditorTab(value: string | null | undefined): value is ProductEditorTab {
  return PRODUCT_EDITOR_TABS.some((tab) => tab === value)
}

/** The read-only "Ver produto" page. */
export function productViewPath(productId: string): string {
  return `/catalogo/produtos/${encodeURIComponent(productId)}`
}

/** The legacy editor of an existing product (until slice W3 retires it). `aba` selects the opening tab. */
export function productEditorPath(productId: string, tab?: ProductEditorTab | null): string {
  const base = `${productViewPath(productId)}/editar-legado`
  return tab && tab !== "dados" ? `${base}?aba=${tab}` : base
}

/** Maps an old assistant/wizard `passo` onto the editor tab that now holds that step. */
export function productEditorTabFromLegacy(step: string | null | undefined): ProductEditorTab | null {
  const passo = cadastroPassoFromLegacy(step, "produtos")
  if (passo === "agenda" || passo === "fila") return "agenda"
  if (passo === "arquivos") return "files"
  if (passo === "precos") return "price"
  if (passo === "regras") return "access"
  return null
}
