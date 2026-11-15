import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, ChevronRight } from "lucide-react"
import { UNSAFE_DataRouterContext as DataRouterContext, useBlocker } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { LeaveConfirmDialog } from "@/components/LeaveConfirmDialog"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { StatusBadge } from "@/components/ui/status"
import { cn } from "@/lib/utils"
import { StepSubmitContext, type StepSubmit, type StepSubmitRegistry } from "./stepSubmit"
import type { ItemStatus } from "./itemStatus"
import { cadastroSteps, type CadastroStep } from "./useCadastroStep"
import "./cadastro.css"

export type CadastroKind = "product" | "resource"

/** Rascunho until the item is published; Publicado afterwards. No percent indicator. */
export function CadastroStatusChip({ status }: { status: ItemStatus | null | undefined }) {
  const { t } = useTranslation()
  const published = status?.kind === "published"
  return <StatusBadge tone={published ? "success" : "neutral"}>{t(published ? "assistant.status.published" : "assistant.status.draft")}</StatusBadge>
}

export function CadastroHeader({ title, step = "dados", description, status }: { title: string; step?: CadastroStep; description?: string; status?: ItemStatus | null }) {
  const { t } = useTranslation()
  return <header className="flex min-w-0 items-start justify-between gap-3">
    <div className="min-w-0 space-y-1">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{description ?? t("cadastro.stepOf", { count: cadastroSteps.indexOf(step) + 1, total: cadastroSteps.length })}</p>
    </div>
    {description !== undefined ? <CadastroStatusChip status={status} /> : null}
  </header>
}

/**
 * Vertical progress (left column from lg, a compact row of bubbles below lg).
 * Done means the saved data is complete; it is never derived from visiting a step.
 * Read-only when `go` is omitted (creation page: the product does not exist yet).
 */
export function CadastroStepper({ step, go, disabled = false, kind = "resource", done = [], optional = [] }: {
  step: CadastroStep; go?: (step: CadastroStep) => void; disabled?: boolean; kind?: CadastroKind
  done?: readonly CadastroStep[]; optional?: readonly CadastroStep[]
}) {
  const { t } = useTranslation()
  const index = cadastroSteps.indexOf(step)
  const product = kind === "product"
  return <nav aria-label={t("cadastro.steps")} className="cadastro-progress min-w-0 max-w-full">
    <p className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">{t(product ? "cadastro.progressCaptionProduct" : "cadastro.progressCaptionResource")}</p>
    <p className="text-sm text-muted-foreground lg:mt-3" data-testid="cadastro-stepper-compact">{t("cadastro.stage", { count: index + 1, total: cadastroSteps.length })}</p>
    <ol className="mt-2 flex min-w-0 max-w-full gap-1 overflow-x-auto lg:mt-3 lg:flex-col lg:overflow-visible">
      {cadastroSteps.map((item, i) => {
        const current = step === item
        const isDone = done.includes(item)
        const isOptional = !isDone && optional.includes(item)
        const name = product ? t(`cadastro.productSteps.${item}.title`) : t(`assistant.steps.${item}`)
        const subtitle = product ? t(`cadastro.productSteps.${item}.subtitle`) : null
        const label = isDone ? `${name}, ${t("cadastro.doneLabel")}` : name
        const bubble = <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium", current ? "border-primary bg-primary text-primary-foreground" : isDone ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")} aria-hidden="true">{isDone && !current ? <Check className="size-3.5" /> : i + 1}</span>
        const text = <span className={cn("min-w-0 text-left", !current && "max-lg:sr-only")}>
          <span className={cn("block truncate text-sm", current ? "font-medium text-primary" : "font-medium text-foreground")}>{name}</span>
          {subtitle ? <span className="block truncate text-xs text-muted-foreground max-lg:hidden" aria-hidden="true">{subtitle}</span> : null}
          {isOptional && !current ? <span className="block text-xs text-muted-foreground max-lg:hidden">{t("cadastro.optional")}</span> : null}
        </span>
        const itemClass = cn("flex min-h-11 w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left", current && "border-border bg-card shadow-sm")
        return <li key={item} className="shrink-0 lg:shrink">
          {go
            ? <Button type="button" variant="ghost" aria-label={label} className={cn(itemClass, "h-auto justify-start whitespace-normal font-normal")} disabled={disabled} aria-current={current ? "step" : undefined} onClick={() => go(item)}>{bubble}{text}</Button>
            : <span aria-label={label} role="group" className={itemClass} aria-current={current ? "step" : undefined}>{bubble}{text}</span>}
        </li>
      })}
    </ol>
    {product ? <div className="mt-6 hidden space-y-1 px-3 lg:block">
      <p className="text-sm font-medium">{t("cadastro.timeTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("cadastro.timeBody")}</p>
    </div> : null}
  </nav>
}

function ShellLeaveGuard({ dirty, bypass }: { dirty: boolean; bypass: { current: boolean } }) {
  const { t } = useTranslation()
  const shouldBlock = useCallback(({ currentLocation, nextLocation }: { currentLocation: { pathname: string; search: string }; nextLocation: { pathname: string; search: string } }) =>
    dirty && !bypass.current && `${currentLocation.pathname}${currentLocation.search}` !== `${nextLocation.pathname}${nextLocation.search}`, [dirty, bypass])
  const blocker = useBlocker(shouldBlock)
  return <LeaveConfirmDialog
    open={blocker.state === "blocked"}
    title={t("fullPage.leaveConfirm")}
    onStay={() => { if (blocker.state === "blocked") blocker.reset() }}
    onLeave={() => { if (blocker.state === "blocked") blocker.proceed() }}
  />
}

export function CadastroShell({ kind = "resource", title, description, status, step, go, interactive = true, busy, dirty = false, done, optional, submitDisabled = false, canPublish, onPublish, onBack, children }: {
  kind?: CadastroKind
  title: string
  /** Header description. Defaults to the product description for products. */
  description?: string
  status?: ItemStatus | null
  step: CadastroStep
  go: (step: CadastroStep) => void
  /** False before the item exists: the progress list is read-only. */
  interactive?: boolean
  dirty?: boolean
  busy: boolean
  /** Disables both save buttons (e.g. invalid creation form). */
  submitDisabled?: boolean
  done?: readonly CadastroStep[]
  optional?: readonly CadastroStep[]
  canPublish: boolean
  onPublish: () => void | Promise<void>
  /** Leaves the cadastro for the list (Cancelar on step 1 and "Salvar e sair"). */
  onBack: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const hasDataRouter = useContext(DataRouterContext) != null
  const index = cadastroSteps.indexOf(step)
  const last = index === cadastroSteps.length - 1
  const product = kind === "product"
  const submitRef = useRef<StepSubmit | null>(null)
  const registry = useMemo<StepSubmitRegistry>(() => ({ register: (submit) => { submitRef.current = submit } }), [])
  const bypass = useRef(false)
  const inFlight = useRef(false)
  const [pending, setPending] = useState<"continue" | "exit" | null>(null)
  const locked = busy || pending !== null

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  /** Navigates after a successful save: the step is clean by then even if its state has not re-rendered yet. */
  function leave(action: () => void) {
    bypass.current = true
    try { action() } finally { bypass.current = false }
  }

  async function saveThen(kind: "continue" | "exit") {
    if (inFlight.current || busy) return
    inFlight.current = true
    setPending(kind)
    try {
      const saved = submitRef.current ? await submitRef.current() : true
      if (!saved) return
      if (kind === "exit") leave(onBack)
      else if (last) await onPublish()
      else leave(() => go(cadastroSteps[index + 1]))
    } catch {
      // The step shows its own error; the footer only stays available.
    } finally {
      inFlight.current = false
      setPending(null)
    }
  }

  const info = product ? { heading: t(`cadastro.productSteps.${step}.title`), text: t(`cadastro.productSteps.${step}.description`) } : null
  return <StepSubmitContext.Provider value={registry}>
    <div className="cadastro-page">
      {hasDataRouter ? <ShellLeaveGuard dirty={dirty} bypass={bypass} /> : null}
      <CadastroHeader title={title} step={step} description={description ?? (product ? t("cadastro.productDescription") : undefined)} status={status ?? null} />
      <div className="cadastro-layout">
        <CadastroStepper step={step} go={interactive ? go : undefined} disabled={locked} kind={kind} done={done} optional={optional} />
        <section aria-label={info?.heading ?? t(`assistant.steps.${step}`)} className="min-w-0 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="space-y-6 p-4 sm:p-8">
            {info ? <div className="space-y-1">
              <h2 className="text-base font-semibold">{info.heading}</h2>
              <p className="text-sm text-muted-foreground">{info.text}</p>
            </div> : null}
            {children}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 sm:px-8">
            <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => index > 0 ? go(cadastroSteps[index - 1]) : onBack()}>{t(index > 0 ? "cadastro.back" : "common.cancel")}</Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <LoadingButton type="button" variant="ghost" className="min-h-11" loading={pending === "exit"} disabled={locked || submitDisabled} onClick={() => void saveThen("exit")}>{t("cadastro.saveAndExit")}</LoadingButton>
              <LoadingButton type="button" className="min-h-11" loading={pending === "continue"} disabled={locked || submitDisabled || (last && !canPublish)} onClick={() => void saveThen("continue")}>
                {last ? t("assistant.publish") : <>{t("cadastro.saveAndContinue")}<ChevronRight aria-hidden="true" /></>}
              </LoadingButton>
            </div>
          </footer>
        </section>
      </div>
      {product ? <p className="text-xs text-muted-foreground">{t("cadastro.requiredNote")}</p> : null}
    </div>
  </StepSubmitContext.Provider>
}
