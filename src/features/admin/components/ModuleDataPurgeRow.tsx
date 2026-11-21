import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { useCallback, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { StatusBadge } from "@/components/ui/status"
import { moduleNameI18nKey } from "@/features/admin/moduleCatalog"
import {
  isPurgeableModuleKey,
  type ModuleDataPurgeBlocker,
  type ModuleDataPurgePreview,
} from "@/features/admin/schemas/moduleDataPurgeSchemas"
import {
  cancelModuleDataPurge,
  getModuleDataPurgePreview,
  ModuleDataPurgeError,
  scheduleModuleDataPurge,
} from "@/features/admin/services/moduleDataPurgeService"

type ModuleDataPurgeRowProps = {
  tenantId: string
  moduleKey: string
}

function formatDate(iso: string, language: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(language, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Collapsible "delete module data" row for one DISABLED purgeable module.
 * The preview is loaded lazily, only when the row is first expanded.
 */
export function ModuleDataPurgeRow({ tenantId, moduleKey }: ModuleDataPurgeRowProps) {
  const { t, i18n } = useTranslation()
  const panelId = useId()
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ModuleDataPurgePreview | null>(null)
  const [dialog, setDialog] = useState<"schedule" | "cancel" | null>(null)
  const [typed, setTyped] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const moduleName = t(moduleNameI18nKey(moduleKey))

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await getModuleDataPurgePreview(tenantId, moduleKey)
      setPreview(result)
      setLoaded(true)
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error ? error.message : t("admin.modulePurge.errors.loadFailed"),
      )
    } finally {
      setLoading(false)
    }
  }, [tenantId, moduleKey, t])

  if (!isPurgeableModuleKey(moduleKey)) return null

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !loaded && !loading) void load()
  }

  function closeDialog() {
    setDialog(null)
    setTyped("")
    setReason("")
    setDialogError(null)
  }

  async function handleSchedule() {
    setSubmitting(true)
    setDialogError(null)
    try {
      await scheduleModuleDataPurge(tenantId, moduleKey, typed.trim())
      toast.success(t("admin.modulePurge.scheduledToast"))
      closeDialog()
      await load()
    } catch (error: unknown) {
      if (error instanceof ModuleDataPurgeError && error.preview) {
        setPreview(error.preview)
      }
      setDialogError(
        error instanceof Error ? error.message : t("admin.modulePurge.errors.scheduleFailed"),
      )
      if (error instanceof ModuleDataPurgeError && error.code === "purge.already_pending") {
        await load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    setSubmitting(true)
    setDialogError(null)
    try {
      await cancelModuleDataPurge(tenantId, moduleKey, reason)
      toast.success(t("admin.modulePurge.cancelledToast"))
      closeDialog()
      await load()
    } catch (error: unknown) {
      setDialogError(
        error instanceof Error ? error.message : t("admin.modulePurge.errors.cancelFailed"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const totalRows = preview?.tables.reduce((sum, row) => sum + row.rows, 0) ?? 0
  const blockers = preview?.blockers ?? []
  const pending = preview?.pending ?? null
  const hasData = totalRows > 0 || (preview?.storageObjects ?? 0) > 0
  const canSchedule = preview !== null && !pending && hasData && blockers.length === 0
  const Chevron = expanded ? ChevronDown : ChevronRight

  function tableLabel(table: string): string {
    const key = `admin.modulePurge.tables.${table.replace(/\./g, "_")}`
    return i18n.exists(key) ? t(key) : table
  }

  function blockerText(blocker: ModuleDataPurgeBlocker): string {
    const table = blocker.table ?? ""
    const ownerKey = table.split(".")[0] ?? ""
    const owner =
      ownerKey !== moduleKey && isPurgeableModuleKey(ownerKey)
        ? t(moduleNameI18nKey(ownerKey))
        : null
    switch (blocker.code) {
      case "module.active":
        return t("admin.modulePurge.blockers.moduleActive", { module: moduleName })
      case "fk.restrict":
        return owner
          ? t("admin.modulePurge.blockers.fkRestrictOwner", {
              table: tableLabel(table),
              owner,
              module: moduleName,
            })
          : t("admin.modulePurge.blockers.fkRestrict", {
              table: table ? tableLabel(table) : "?",
              module: moduleName,
            })
      case "fk.cascade":
        return t("admin.modulePurge.blockers.fkCascade", {
          table: table ? tableLabel(table) : "?",
        })
      case "allocations.unreleased":
        return t("admin.modulePurge.blockers.allocationsUnreleased")
      default:
        return t("admin.modulePurge.blockers.unknown", { code: blocker.code })
    }
  }

  return (
    <div className="rounded-lg border border-border" data-testid={`module-purge-${moduleKey}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40"
      >
        <Chevron className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{moduleName}</span>
        {pending ? (
          <StatusBadge tone="warning">
            {t("admin.modulePurge.pendingChip", {
              date: formatDate(pending.scheduledFor, i18n.language),
            })}
          </StatusBadge>
        ) : null}
      </button>

      {expanded ? (
        <div id={panelId} className="space-y-3 border-t border-border px-4 py-3 text-sm">
          {loading ? (
            <p className="flex items-center gap-2 text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("admin.modulePurge.loading")}
            </p>
          ) : null}

          {loadError ? (
            <div className="space-y-2">
              <p className="text-destructive" role="alert">
                {loadError}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                {t("admin.modules.retry")}
              </Button>
            </div>
          ) : null}

          {preview && !loading ? (
            <>
              {hasData ? (
                <div className="space-y-2">
                  <p className="font-medium">
                    {t("admin.modulePurge.storedData", { count: totalRows })}
                    {preview.storageObjects > 0
                      ? ` · ${t("admin.modulePurge.storageObjects", { count: preview.storageObjects })}`
                      : ""}
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    {preview.tables.map((row) => (
                      <li key={row.table} className="flex justify-between gap-4">
                        <span title={row.table}>{tableLabel(row.table)}</span>
                        <span>{row.rows}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground">{t("admin.modulePurge.noData")}</p>
              )}

              {blockers.length > 0 ? (
                <ul className="space-y-1 text-destructive" role="alert">
                  {blockers.map((blocker, index) => (
                    <li key={`${blocker.code}-${blocker.table ?? ""}-${index}`}>
                      {blockerText(blocker)}
                    </li>
                  ))}
                </ul>
              ) : null}

              {pending ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDialog("cancel")
                  }}
                >
                  {t("admin.modulePurge.cancelAction")}
                </Button>
              ) : hasData ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!canSchedule}
                  onClick={() => {
                    setDialog("schedule")
                  }}
                >
                  {t("admin.modulePurge.deleteAction")}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={dialog === "schedule"}
        onOpenChange={(open) => {
          if (!open && !submitting) closeDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.modulePurge.dialog.title", { module: moduleName })}</DialogTitle>
            <DialogDescription>{t("admin.modulePurge.dialog.grace")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${panelId}-confirm`}>
              {t("admin.modulePurge.dialog.confirmLabel", { key: moduleKey })}
            </Label>
            <Input
              id={`${panelId}-confirm`}
              value={typed}
              autoComplete="off"
              disabled={submitting}
              onChange={(event) => {
                setTyped(event.target.value)
              }}
            />
            {dialogError ? (
              <p className="text-sm text-destructive" role="alert">
                {dialogError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={closeDialog}>
              {t("admin.modulePurge.dialog.back")}
            </Button>
            <LoadingButton
              type="button"
              variant="destructive"
              loading={submitting}
              disabled={typed.trim() !== moduleKey || !canSchedule}
              onClick={() => void handleSchedule()}
            >
              {t("admin.modulePurge.dialog.confirm")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "cancel"}
        onOpenChange={(open) => {
          if (!open && !submitting) closeDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.modulePurge.cancelDialog.title", { module: moduleName })}
            </DialogTitle>
            <DialogDescription>{t("admin.modulePurge.cancelDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${panelId}-reason`}>
              {t("admin.modulePurge.cancelDialog.reasonLabel")}
            </Label>
            <Input
              id={`${panelId}-reason`}
              value={reason}
              maxLength={500}
              disabled={submitting}
              onChange={(event) => {
                setReason(event.target.value)
              }}
            />
            {dialogError ? (
              <p className="text-sm text-destructive" role="alert">
                {dialogError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={closeDialog}>
              {t("admin.modulePurge.dialog.back")}
            </Button>
            <LoadingButton type="button" loading={submitting} onClick={() => void handleCancel()}>
              {t("admin.modulePurge.cancelDialog.confirm")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
