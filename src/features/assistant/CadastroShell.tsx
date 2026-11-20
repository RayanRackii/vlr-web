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
import { cadastroSteps, productOnlySteps, type CadastroStep } from "./useCadastroStep"
import "./cadastro.css"

export type CadastroKind = "product" | "resource"

/** Rascunho until the item is published; Publicado afterwards. No percent indicator. */
export function CadastroStatusChip({ status, kind = "resource" }: { status: ItemStatus | null | undefined; kind?: CadastroKind }) {
  const { t } = useTranslation()
  const published = status?.kind === "published"
  // Products are "Ativo" everywhere (list, toast, badge); resources keep "Publicado".
  const publishedKey = kind === "product" ? "cadastro.productStatusActive" : "assistant.status.published"
  return <StatusBadge tone={published ? "success" : "neutral"}>{t(published ? publishedKey : "assistant.status.draft")}</StatusBadge>
}

/** Steps shown for a kind of item, in order. Resources do not have the product-only steps. */
function stepsOf(kind: CadastroKind): readonly CadastroStep[] {
  return kind === "product" ? cadastroSteps : cadastroSteps.filter((item) => !productOnlySteps.includes(item))
}

/** Steps that apply, in order (the rest are "Não se aplica"). */
function applicableSteps(notApplicable: readonly CadastroStep[], kind: CadastroKind): CadastroStep[] {
  return stepsOf(kind).filter((item) => !notApplicable.includes(item))
}

/** 1-based position among the applicable steps (a not-applicable current step counts the applicable ones before it). */
function stagePosition(step: CadastroStep, notApplicable: readonly CadastroStep[], kind: CadastroKind): number {
  const list = stepsOf(kind)
  const before = list.slice(0, Math.max(list.indexOf(step), 0)).filter((item) => !notApplicable.includes(item)).length
  return notApplicable.includes(step) ? Math.max(before, 1) : before + 1
}

/** Closest applicable step in a direction, or null at the ends. */
function neighborStep(step: CadastroStep, direction: -1 | 1, notApplicable: readonly CadastroStep[], kind: CadastroKind): CadastroStep | null {
  const list = stepsOf(kind)
  for (let i = list.indexOf(step) + direction; i >= 0 && i < list.length; i += direction) {
    if (!notApplicable.includes(list[i])) return list[i]
  }
  return null
}

export function CadastroHeader({ title, step = "dados", description, status, notApplicable = [], kind = "resource", hideChip = false }: { title: string; step?: CadastroStep; description?: string; status?: ItemStatus | null; notApplicable?: readonly CadastroStep[]; kind?: CadastroKind; hideChip?: boolean }) {
  const { t } = useTranslation()
  return <header className="flex min-w-0 items-start justify-between gap-3">
    <div className="min-w-0 space-y-1">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{description ?? t("cadastro.stepOf", { count: stagePosition(step, notApplicable, kind), total: applicableSteps(notApplicable, kind).length })}</p>
    </div>
    {description !== undefined && !hideChip ? <CadastroStatusChip status={status} kind={kind} /> : null}
  </header>
}

/**
 * Vertical progress (left column from lg, a compact row of bubbles below lg).
 * Done means the saved data is complete; it is never derived from visiting a step.
 * Read-only when `go` is omitted (creation page: the product does not exist yet).
 */
export function CadastroStepper({ step, go, disabled = false, kind = "resource", done = [], optional = [], notApplicable = [], hideStage = false }: {
  step: CadastroStep; go?: (step: CadastroStep) => void; disabled?: boolean; kind?: CadastroKind
  /** Edit mode of an active product: free navigation, no "Etapa X de N" counters. */
  hideStage?: boolean
  done?: readonly CadastroStep[]; optional?: readonly CadastroStep[]
  /** Muted, not clickable, counted as done ("Não se aplica"). */
  notApplicable?: readonly CadastroStep[]
}) {
  const { t } = useTranslation()
  const product = kind === "product"
  return <nav aria-label={t("cadastro.steps")} className="cadastro-progress min-w-0 max-w-full">
    <p className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">{t(product ? "cadastro.progressCaptionProduct" : "cadastro.progressCaptionResource")}</p>
    <p className="text-sm text-muted-foreground lg:mt-3" data-testid="cadastro-stepper-compact">
      {hideStage ? null : <><span>{t("cadastro.stage", { count: stagePosition(step, notApplicable, kind), total: applicableSteps(notApplicable, kind).length })}</span>{" "}</>}
      <span data-testid="cadastro-stepper-name">{hideStage ? (product ? t(`cadastro.productSteps.${step}.title`) : t(`assistant.steps.${step}`)) : t("cadastro.stageName", { name: product ? t(`cadastro.productSteps.${step}.title`) : t(`assistant.steps.${step}`) })}</span>
    </p>
    <ol className="mt-2 flex items-center gap-1.5 lg:hidden" aria-hidden="true" data-testid="cadastro-stepper-dots">
      {applicableSteps(notApplicable, kind).map((item) => <li key={item} data-testid="cadastro-stepper-dot" data-current={item === step || undefined} className={cn("size-2 rounded-full", item === step ? "bg-primary" : "bg-border")} />)}
    </ol>
    {/* `relative` makes the list the containing block of the absolutely positioned sr-only labels, so its scroll clips them instead of widening the page. */}
    <ol data-testid="cadastro-stepper-steps" className="relative mt-2 flex min-w-0 max-w-full gap-1 overflow-x-auto lg:mt-3 lg:flex-col lg:overflow-visible">
      {stepsOf(kind).map((item, i) => {
        const current = step === item
        const skipped = notApplicable.includes(item)
        const isDone = skipped || done.includes(item)
        const isOptional = !isDone && optional.includes(item)
        const name = product ? t(`cadastro.productSteps.${item}.title`) : t(`assistant.steps.${item}`)
        const subtitle = product ? t(`cadastro.productSteps.${item}.subtitle`) : null
        const label = skipped ? `${name}, ${t("cadastro.notApplicable")}` : isDone ? `${name}, ${t("cadastro.doneLabel")}` : name
        const bubble = <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium", current ? "border-primary bg-primary text-primary-foreground" : isDone ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")} aria-hidden="true">{isDone && !current ? <Check className="size-3.5" /> : i + 1}</span>
        const text = <span className={cn("min-w-0 text-left", !current && "max-lg:sr-only")}>
          <span className={cn("block truncate text-sm", current ? "font-medium text-primary" : "font-medium text-foreground")}>{name}</span>
          {subtitle ? <span className="block truncate text-xs text-muted-foreground max-lg:hidden" aria-hidden="true">{subtitle}</span> : null}
          {skipped ? <span className="block text-xs text-muted-foreground">{t("cadastro.notApplicable")}</span> : null}
          {isOptional && !current ? <span className="block text-xs text-muted-foreground max-lg:hidden">{t("cadastro.optional")}</span> : null}
        </span>
        const itemClass = cn("flex min-h-11 w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left", current && "border-border bg-card shadow-sm")
        if (skipped) {
          return <li key={item} className="shrink-0 opacity-60 lg:shrink">
            <span aria-label={label} role="group" aria-disabled="true" className={itemClass}>{bubble}{text}</span>
          </li>
        }
        return <li key={item} className="shrink-0 lg:shrink">
          {go
            ? <Button type="button" variant="ghost" aria-label={label} className={cn(itemClass, "h-auto justify-start whitespace-normal font-normal")} disabled={disabled} aria-current={current ? "step" : undefined} onClick={() => go(item)}>{bubble}{text}</Button>
            : <span aria-label={label} role="group" className={itemClass} aria-current={current ? "step" : undefined}>{bubble}{text}</span>}
        </li>
      })}
    </ol>
    {product && !hideStage ? <div className="mt-6 hidden space-y-1 px-3 lg:block" data-testid="cadastro-time-hint">
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

/** Edit mode of an existing product: the footer is Cancelar + Salvar alterações instead of the creation flow. */
export type CadastroEditMode = {
  /** Active product: no "Rascunho" chip and no "Etapa X de N" counters. */
  active: boolean
  onCancel: () => void
  /** Runs after the current step saved successfully. */
  onSaved: () => void
}

export function CadastroShell({ kind = "resource", edit, title, description, status, step, go, interactive = true, busy, dirty = false, done, optional, notApplicable = [], submitDisabled = false, canPublish, completed = false, onPublish, onBack, children }: {
  kind?: CadastroKind
  edit?: CadastroEditMode
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
  /** Steps that do not apply (e.g. Agenda and Fila for a product without schedule): shown muted and skipped. */
  notApplicable?: readonly CadastroStep[]
  canPublish: boolean
  /** The item was just published: the step body is a success state, so the step intro and footer are hidden. */
  completed?: boolean
  onPublish: () => void | Promise<void>
  /** Leaves the cadastro for the list (Cancelar on step 1 and "Salvar e sair"). */
  onBack: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const hasDataRouter = useContext(DataRouterContext) != null
  const nextStep = neighborStep(step, 1, notApplicable, kind)
  const previousStep = neighborStep(step, -1, notApplicable, kind)
  const last = nextStep === null
  const product = kind === "product"
  const submitRef = useRef<StepSubmit | null>(null)
  const registry = useMemo<StepSubmitRegistry>(() => ({ register: (submit) => { submitRef.current = submit } }), [])
  const bypass = useRef(false)
  const inFlight = useRef(false)
  const [pending, setPending] = useState<"continue" | "exit" | "edit" | null>(null)
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

  async function saveThen(kind: "continue" | "exit" | "edit") {
    if (inFlight.current || busy) return
    inFlight.current = true
    setPending(kind)
    try {
      const saved = submitRef.current ? await submitRef.current() : true
      if (!saved) return
      if (kind === "edit") leave(() => edit?.onSaved())
      else if (kind === "exit") leave(onBack)
      else if (last) await onPublish()
      else if (nextStep) leave(() => go(nextStep))
    } catch {
      // The step shows its own error; the footer only stays available.
    } finally {
      inFlight.current = false
      setPending(null)
    }
  }

  const hideProgress = edit?.active === true
  // A product that is not published yet (inactive, or not on the portal menu) still publishes from the last step.
  const editPublishing = edit != null && last && status?.kind !== "published"
  const info = product && !completed ? { heading: t(`cadastro.productSteps.${step}.title`), text: t(`cadastro.productSteps.${step}.description`) } : null
  return <StepSubmitContext.Provider value={registry}>
    <div className="cadastro-page mx-auto w-full max-w-[1120px] self-center" data-testid="cadastro-page">
      {hasDataRouter ? <ShellLeaveGuard dirty={dirty} bypass={bypass} /> : null}
      <CadastroHeader kind={kind} title={edit ? t("cadastro.editTitle") : title} step={step} description={edit ? title : description ?? (product ? t("cadastro.productDescription") : undefined)} status={status ?? null} notApplicable={notApplicable} hideChip={hideProgress} />
      <div className="cadastro-layout">
        <CadastroStepper step={step} go={interactive ? go : undefined} disabled={locked} kind={kind} done={done} optional={optional} notApplicable={notApplicable} hideStage={hideProgress} />
        <section aria-label={info?.heading ?? t(`assistant.steps.${step}`)} className="min-w-0 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="space-y-6 p-4 sm:p-8">
            {info ? <div className="space-y-1">
              <h2 className="text-base font-semibold">{info.heading}</h2>
              <p className="text-sm text-muted-foreground">{info.text}</p>
            </div> : null}
            {children}
          </div>
          {completed ? null : edit ? <footer className="flex flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-8" data-testid="cadastro-edit-footer">
            <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={locked} onClick={edit.onCancel}>{t("common.cancel")}</Button>
            {editPublishing
              ? <LoadingButton type="button" className="min-h-11 w-full sm:w-auto" loading={pending === "continue"} disabled={locked || submitDisabled || !canPublish} onClick={() => void saveThen("continue")}>{t("assistant.publish")}</LoadingButton>
              : <LoadingButton type="button" className="min-h-11 w-full sm:w-auto" loading={pending === "edit"} disabled={locked || submitDisabled} onClick={() => void saveThen("edit")}>{t("cadastro.saveChanges")}</LoadingButton>}
          </footer> : <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 sm:px-8">
            <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => previousStep ? go(previousStep) : onBack()}>{t(previousStep ? "cadastro.back" : "common.cancel")}</Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <LoadingButton type="button" variant="ghost" className="min-h-11" loading={pending === "exit"} disabled={locked || submitDisabled} onClick={() => void saveThen("exit")}>{t("cadastro.saveAndExit")}</LoadingButton>
              <LoadingButton type="button" className="min-h-11" loading={pending === "continue"} disabled={locked || submitDisabled || (last && !canPublish)} onClick={() => void saveThen("continue")}>
                {last ? t("assistant.publish") : <>{t("cadastro.saveAndContinue")}<ChevronRight aria-hidden="true" /></>}
              </LoadingButton>
            </div>
          </footer>}
        </section>
      </div>
      {product ? <p className="text-xs text-muted-foreground">{t("cadastro.requiredNote")}</p> : null}
    </div>
  </StepSubmitContext.Provider>
}
