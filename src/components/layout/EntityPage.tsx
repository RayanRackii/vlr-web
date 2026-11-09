import { useContext, useEffect, type ReactNode } from "react"
import {
  UNSAFE_DataRouterContext as DataRouterContext,
  useBlocker,
} from "react-router-dom"
import { useTranslation } from "react-i18next"

import { LeaveConfirmDialog } from "@/components/LeaveConfirmDialog"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type EntityTab = {
  value: string
  label: string
  /** Optional count/badge shown next to the label. */
  badge?: ReactNode
  content: ReactNode
}

type EntityPageProps = {
  breadcrumb?: ReactNode
  title: ReactNode
  /** Status badges / chips shown next to the title. */
  badges?: ReactNode
  tabs?: readonly EntityTab[]
  /** Opt in to multiple rows instead of the default horizontal scroll. */
  wrapTabs?: boolean
  /** Controlled active tab. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Content when the page has no tabs. */
  children?: ReactNode
  dirty?: boolean
  unsavedCount?: number
  onSave?: () => void
  onDiscard?: () => void
  saving?: boolean
  /** Disable the Save button while keeping the bar visible (e.g. invalid fields). */
  saveDisabled?: boolean
  saveLabel?: string
  /** Guard navigation away while dirty (default true). */
  guardUnsaved?: boolean
  className?: string
}

/**
 * In-app leave guard. Only mounted when a data router is present (useBlocker
 * throws otherwise); the app-level beforeunload guard covers tab/window close.
 */
function RouterLeaveGuard({ when, message }: { when: boolean; message: string }) {
  const blocker = useBlocker(when)
  const open = blocker.state === "blocked"
  return (
    <LeaveConfirmDialog
      open={open}
      title={message}
      onStay={() => {
        if (blocker.state === "blocked") blocker.reset()
      }}
      onLeave={() => {
        if (blocker.state === "blocked") blocker.proceed()
      }}
    />
  )
}

/**
 * Shared full-page editor layout: breadcrumb, header (title + badges + Salvar),
 * subject tabs (horizontal scroll on mobile), a sticky bottom save bar when
 * dirty, and an unsaved-changes guard. Props-driven, no data fetching.
 */
export function EntityPage({
  breadcrumb,
  title,
  badges,
  tabs,
  wrapTabs = false,
  value,
  defaultValue,
  onValueChange,
  children,
  dirty = false,
  unsavedCount = 0,
  onSave,
  onDiscard,
  saving = false,
  saveDisabled = false,
  saveLabel,
  guardUnsaved = true,
  className,
}: EntityPageProps) {
  const { t } = useTranslation()
  const guard = guardUnsaved && dirty
  const leaveMessage = t("fullPage.leaveConfirm")
  const hasDataRouter = useContext(DataRouterContext) != null

  // beforeunload covers tab/window close regardless of router type.
  useEffect(() => {
    if (!guard) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [guard])

  const saveButton = onSave ? (
    <LoadingButton type="button" loading={saving} disabled={!dirty || saveDisabled} onClick={onSave}>
      {saveLabel ?? t("fullPage.save")}
    </LoadingButton>
  ) : null

  return (
    <div className={cn("flex flex-col gap-4 pb-24", className)}>
      {hasDataRouter ? <RouterLeaveGuard when={guard} message={leaveMessage} /> : null}
      {breadcrumb}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-xl font-semibold text-foreground">{title}</h1>
        {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
        {saveButton ? <div className="ml-auto">{saveButton}</div> : null}
      </header>

      {tabs && tabs.length > 0 ? (
        <Tabs value={value} defaultValue={defaultValue ?? tabs[0]?.value} onValueChange={onValueChange}>
          <div className={wrapTabs ? "min-w-0 px-1" : "-mx-1 overflow-x-auto px-1"}>
            <TabsList variant="line" className={wrapTabs ? "!h-auto w-full flex-wrap justify-start" : "w-max"}>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                  {tab.badge !== undefined ? (
                    <span className="text-xs text-muted-foreground tabular-nums">{tab.badge}</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        children
      )}

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-2">
            <span className="text-sm text-muted-foreground">
              {t("fullPage.unsavedChanges", { count: unsavedCount })}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {onDiscard ? (
                <Button type="button" variant="ghost" onClick={onDiscard}>
                  {t("fullPage.discard")}
                </Button>
              ) : null}
              {saveButton}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
