import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  BOOKING_UI_ENABLED_KEY,
  getAdminTenantBooleanSetting,
  putAdminTenantBooleanSetting,
} from "@/features/admin/services/adminTenantSettingsService"

type TenantAdvancedSettingsProps = {
  tenantId: string
}

/**
 * Platform-admin panel for the allow-listed tenant settings. Only settings whose
 * data source exists today are editable: the booking map switch. The teacher-lesson
 * asset scope needs an admin endpoint that lists a tenant's rental assets, which the
 * API does not expose yet, so it is intentionally not offered here.
 */
export function TenantAdvancedSettings({ tenantId }: TenantAdvancedSettingsProps) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const value = await getAdminTenantBooleanSetting(tenantId, BOOKING_UI_ENABLED_KEY)
        if (!cancelled) setEnabled(value)
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : t("admin.edit.advanced.errors.loadFailed"),
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [attempt, t, tenantId])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  async function onToggle(next: boolean) {
    setIsSaving(true)
    try {
      setEnabled(await putAdminTenantBooleanSetting(tenantId, BOOKING_UI_ENABLED_KEY, next))
      toast.success(t("admin.edit.advanced.saved"))
    } catch (error: unknown) {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.edit.advanced.errors.saveFailed"),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t("admin.edit.advanced.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.edit.advanced.description")}</p>
      </div>

      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <div className="min-w-0">
            <Label htmlFor="tenant-booking-ui-enabled">
              {t("admin.edit.advanced.bookingUi.label")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("admin.edit.advanced.bookingUi.hint")}
            </p>
          </div>
          <Switch
            id="tenant-booking-ui-enabled"
            checked={enabled}
            disabled={isLoading || isSaving}
            onCheckedChange={(next) => {
              void onToggle(next)
            }}
          />
        </div>
      )}
    </div>
  )
}
