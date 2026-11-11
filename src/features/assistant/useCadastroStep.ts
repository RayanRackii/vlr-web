import { useSearchParams } from "react-router-dom"

export const cadastroSteps = ["dados", "categorias", "agenda", "fila", "regras", "precos", "publicacao"] as const
export type CadastroStep = typeof cadastroSteps[number]

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

