import { useSearchParams } from "react-router-dom"

export const cadastroSteps = ["dados", "categorias", "agenda", "fila", "regras", "precos", "publicacao"] as const
export type CadastroStep = typeof cadastroSteps[number]

export type CadastroArea = "produtos" | "recursos"

/** Product audience is the cadastro `regras` step. Resource schedule rules are the `agenda` step. */
const legacyWizardPasso: Record<CadastroArea, Record<string, CadastroStep | null>> = {
  produtos: {
    status: null,
    offer: "precos",
    access: "regras",
    resource: "agenda",
  },
  recursos: {
    status: null,
    rules: "agenda",
    prices: "precos",
    agenda: "agenda",
  },
}

/** Maps an old wizard `passo` onto a cadastro step. `dados` is the default and is omitted. */
export function cadastroPassoFromLegacy(step: string | null | undefined, area: CadastroArea): CadastroStep | null {
  if (!step) return null
  if ((cadastroSteps as readonly string[]).includes(step)) return step === "dados" ? null : step as CadastroStep
  return legacyWizardPasso[area][step] ?? null
}

export function withCadastroPasso(path: string, step: string | null | undefined, area: CadastroArea): string {
  const passo = cadastroPassoFromLegacy(step, area)
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

