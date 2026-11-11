import type { ReactNode } from "react"
import { cadastroSteps, type CadastroStep } from "./useCadastroStep"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import "./cadastro.css"

export function CadastroHeader({ title, step = "dados" }: { title: string; step?: CadastroStep }) {
  const { t } = useTranslation()
  return <header className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("cadastro.title")}</p>
    <h1 className="text-[26px] font-bold tracking-tight text-foreground">{title}</h1>
    <p className="text-sm text-muted-foreground">{t("cadastro.subtitle", { count: cadastroSteps.indexOf(step) + 1, total: cadastroSteps.length, step: t(`assistant.steps.${step}`) })}</p>
  </header>
}

export function CadastroShell({ title, step, go, busy, dirty = false, canPublish, onPublish, onBack, children }: {
  title: string; step: CadastroStep; go: (step: CadastroStep) => void
  dirty?: boolean; busy: boolean; canPublish: boolean; onPublish: () => void; onBack: () => void; children: ReactNode
}) {
  const { t } = useTranslation()
  const index = cadastroSteps.indexOf(step)
  return <div className="cadastro-page">
    <CadastroHeader title={title} step={step} />
    <nav aria-label={t("cadastro.steps")} className="overflow-x-auto rounded-xl border bg-card">
      <ol className="flex min-w-max p-2">
        {cadastroSteps.map((item, i) => <li key={item}>
          <Button type="button" variant="ghost" className="min-h-11 gap-2" disabled={busy || dirty} aria-current={step === item ? "step" : undefined} onClick={() => go(item)}>
            <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${step === item ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} aria-hidden="true">{i < index ? "✓" : i + 1}</span>
            {t(`assistant.steps.${item}`)}
          </Button>
        </li>)}
      </ol>
    </nav>
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
