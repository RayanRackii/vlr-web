import type { ReactNode } from "react"
import { cadastroSteps, type CadastroStep } from "./useCadastroStep"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import "./cadastro.css"

export function CadastroHeader({ title, step = "dados", area }: { title: string; step?: CadastroStep; area: "products" | "resources" }) {
  const { t } = useTranslation()
  return <header className="min-w-0 space-y-1">
    <p className="cadastro-eyebrow">{t(area === "products" ? "cadastro.eyebrowProducts" : "cadastro.eyebrowResources")}</p>
    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
    <p className="max-w-2xl text-sm text-muted-foreground">{t("cadastro.subtitle", { count: cadastroSteps.indexOf(step) + 1, total: cadastroSteps.length, step: t(`assistant.steps.${step}`) })}</p>
  </header>
}

export function CadastroShell({ title, step, area, go, busy, dirty = false, canPublish, onPublish, onBack, children }: {
  title: string; step: CadastroStep; area: "products" | "resources"; go: (step: CadastroStep) => void
  dirty?: boolean; busy: boolean; canPublish: boolean; onPublish: () => void; onBack: () => void; children: ReactNode
}) {
  const { t } = useTranslation()
  const index = cadastroSteps.indexOf(step)
  return <div className="cadastro-page">
    <CadastroHeader title={title} step={step} area={area} />
    <nav aria-label={t("cadastro.steps")} className="min-w-0 max-w-full overflow-x-auto rounded-xl border bg-card">
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
