import { useContext, useEffect } from "react"
import {
  UNSAFE_DataRouterContext as DataRouterContext,
  useBlocker,
} from "react-router-dom"
import { useTranslation } from "react-i18next"

import { LeaveConfirmDialog } from "@/components/LeaveConfirmDialog"

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
 * Warns before leaving with unsaved changes: beforeunload (tab/window close,
 * any router) plus the in-app leave dialog when a data router is present.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const { t } = useTranslation()
  const hasDataRouter = useContext(DataRouterContext) != null

  useEffect(() => {
    if (!when) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [when])

  return hasDataRouter ? (
    <RouterLeaveGuard when={when} message={t("fullPage.leaveConfirm")} />
  ) : null
}
