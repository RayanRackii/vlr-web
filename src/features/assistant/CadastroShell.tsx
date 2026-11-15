import type { ReactNode } from "react"
import { cadastroSteps, type CadastroStep } from "./useCadastroStep"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import "./cadastro.css"

export function CadastroHeader({ title, step = "dados" }: { title: string; step?: CadastroStep }) {
  const { t } = useTranslation()
  return <header className="min-w-0 space-y-1">
    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
    <p className="text-sm text-muted-foreground">{t("cadastro.stepOf", { count: cadastroSteps.indexOf(step) + 1, total: cadastroSteps.length })}</p>
  </header>
}

/** Step names for every step (done, current, pending). Read-only when `go` is omitted (creation page). */
export function CadastroStepper({ step, go, disabled = false }: { step: CadastroStep; go?: (step: CadastroStep) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  const index = cadastroSteps.indexOf(step)
  return <nav aria-label={t("cadastro.steps")} className="min-w-0 max-w-full rounded-xl border bg-card">
    <p className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:hidden" data-testid="cadastro-stepper-compact">
      <span className="font-medium text-primary">{t(`assistant.steps.${step}`)}</span>
      <span className="text-muted-foreground">{t("cadastro.stepCompact", { count: index + 1, total: cadastroSteps.length })}</span>
    </p>
    <ol className="hidden min-w-0 max-w-full overflow-x-auto p-2 sm:flex">
      {cadastroSteps.map((item, i) => {
        const bubble = <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${step === item ? "border-primary bg-primary text-primary-foreground" : i < index ? "border-primary text-primary" : "border-border"}`} aria-hidden="true">{i < index ? "✓" : i + 1}</span>
        return <li key={item} className="shrink-0">
          {go
            ? <Button type="button" variant="ghost" className="min-h-11 gap-2" disabled={disabled} aria-current={step === item ? "step" : undefined} onClick={() => go(item)}>{bubble}{t(`assistant.steps.${item}`)}</Button>
            : <span className={`inline-flex min-h-11 items-center gap-2 px-3 text-sm ${step === item ? "font-medium" : "text-muted-foreground"}`} aria-current={step === item ? "step" : undefined}>{bubble}{t(`assistant.steps.${item}`)}</span>}
        </li>
      })}
    </ol>
  </nav>
}

export function CadastroShell({ title, step, go, busy, dirty = false, canPublish, onPublish, onBack, children }: {
  title: string; step: CadastroStep; go: (step: CadastroStep) => void
  dirty?: boolean; busy: boolean; canPublish: boolean; onPublish: () => void; onBack: () => void; children: ReactNode
}) {
  const { t } = useTranslation()
  const index = cadastroSteps.indexOf(step)
  return <div className="cadastro-page">
    <CadastroHeader title={title} step={step} />
    <CadastroStepper step={step} go={go} disabled={busy || dirty} />
    <div className="space-y-6 rounded-xl border bg-card p-4 text-card-foreground sm:p-6">
      {children}
      {dirty ? <p role="status" className="text-sm text-muted-foreground">{t("cadastro.saveBeforeContinue")}</p> : null}
      <footer className="flex justify-between gap-3 border-t pt-5">
        <Button type="button" variant="outline" className="min-h-11" disabled={busy || dirty} onClick={() => index > 0 ? go(cadastroSteps[index - 1]) : onBack()}>{t("cadastro.back")}</Button>
        <Button type="button" className="min-h-11" disabled={busy || dirty || (index === cadastroSteps.length - 1 && !canPublish)} onClick={() => index < cadastroSteps.length - 1 ? go(cadastroSteps[index + 1]) : onPublish()}>{t(index === cadastroSteps.length - 1 ? "assistant.publish" : "cadastro.next")}</Button>
      </footer>
    </div>
  </div>
}
