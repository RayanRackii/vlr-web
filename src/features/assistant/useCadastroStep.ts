import { useSearchParams } from "react-router-dom"

export const cadastroSteps = ["dados", "categorias", "agenda", "fila", "regras", "precos", "publicacao"] as const
export type CadastroStep = typeof cadastroSteps[number]

const legacyWizardPasso: Record<string, CadastroStep | null> = {
  status: null,
  offer: "precos",
  access: "publicacao",
  resource: "agenda",
  rules: "regras",
  prices: "precos",
  agenda: "agenda",
}

/** Maps an old wizard `passo` onto a cadastro step. `dados` is the default and is omitted. */
export function cadastroPassoFromLegacy(step: string | null | undefined): CadastroStep | null {
  if (!step) return null
  if ((cadastroSteps as readonly string[]).includes(step)) return step === "dados" ? null : step as CadastroStep
  return legacyWizardPasso[step] ?? null
}

export function withCadastroPasso(path: string, step: string | null | undefined): string {
  const passo = cadastroPassoFromLegacy(step)
  return passo ? `${path}?passo=${passo}` : path
}

export function useCadastroStep() {
  const [params, setParams] = useSearchParams()
  const value = params.get("passo")
  const step: CadastroStep = cadastroSteps.find((item) => item === value) ?? "dados"
  return { step, go: (next: CadastroStep) => setParams((current) => {
    const result = new URLSearchParams(current)
    result.set("passo", next)
    return result
  }) }
}

