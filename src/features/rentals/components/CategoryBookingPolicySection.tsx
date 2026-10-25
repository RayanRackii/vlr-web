import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BOOKING_HORIZON_DAY_MAX,
  CANCEL_CUTOFF_HOURS_MAX,
  parseOptionalWholeNumber,
  type CategoryBookingPolicy,
} from "@/features/rentals/schemas/bookingPolicySchemas"
import {
  getCategoryBookingPolicies,
  replaceCategoryBookingPolicy,
} from "@/features/rentals/services/bookingPolicyService"

type Draft = { days: string; hours: string }

const toDraft = (policy: CategoryBookingPolicy): Draft => ({
  days: policy.maxAdvanceBookingDays?.toString() ?? "",
  hours: policy.cancelCutoffHours?.toString() ?? "",
})

/** Middle policy layer: resource override > category > tenant default. */
export function CategoryBookingPolicySection({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<CategoryBookingPolicy[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCategoryBookingPolicies()
      .then((items) => {
        if (cancelled) return
        setRows(items)
        setDrafts(Object.fromEntries(items.map((item) => [item.categoryId, toDraft(item)])))
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setRows([])
        toast.error(error instanceof Error ? error.message : t("rentals.bookingPolicy.loadError"))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  if (rows === null) return null

  async function save(row: CategoryBookingPolicy) {
    const draft = drafts[row.categoryId] ?? toDraft(row)
    const days = parseOptionalWholeNumber(draft.days, BOOKING_HORIZON_DAY_MAX)
    const hours = parseOptionalWholeNumber(draft.hours, CANCEL_CUTOFF_HOURS_MAX)
    if (days === undefined || hours === undefined) {
      toast.error(t("rentals.bookingPolicy.categories.invalid"))
      return
    }
    setSavingId(row.categoryId)
    try {
      const updated = await replaceCategoryBookingPolicy(row.categoryId, {
        maxAdvanceBookingDays: days,
        cancelCutoffHours: hours,
      })
      setRows((current) =>
        (current ?? []).map((item) => (item.categoryId === updated.categoryId ? updated : item)),
      )
      setDrafts((current) => ({ ...current, [updated.categoryId]: toDraft(updated) }))
      toast.success(t("rentals.bookingPolicy.categories.saved"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("rentals.bookingPolicy.saveError"))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section
      className="space-y-4 rounded-lg border border-border p-4"
      data-testid="category-booking-policy"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("rentals.bookingPolicy.categories.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("rentals.bookingPolicy.categories.description")}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("rentals.bookingPolicy.categories.empty")}</p>
      ) : null}
      {rows.map((row) => {
        const draft = drafts[row.categoryId] ?? toDraft(row)
        const disabled = !canEdit || savingId !== null
        const dirty = draft.days !== toDraft(row).days || draft.hours !== toDraft(row).hours
        const setDraft = (patch: Partial<Draft>) =>
          setDrafts((current) => ({ ...current, [row.categoryId]: { ...draft, ...patch } }))
        return (
          <div
            key={row.categoryId}
            className="grid gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end"
            data-testid={`category-policy-${row.categoryId}`}
          >
            <p className="text-sm font-medium">{row.categoryName}</p>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>{t("rentals.bookingPolicy.categories.horizonDays")}</span>
              <Input
                inputMode="numeric"
                value={draft.days}
                placeholder={t("rentals.bookingPolicy.categories.inherit")}
                disabled={disabled}
                onChange={(event) => setDraft({ days: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>{t("rentals.bookingPolicy.categories.cancelCutoffHours")}</span>
              <Input
                inputMode="numeric"
                value={draft.hours}
                placeholder={t("rentals.bookingPolicy.categories.inherit")}
                disabled={disabled}
                onChange={(event) => setDraft({ hours: event.target.value })}
              />
            </label>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !dirty}
                onClick={() => {
                  void save(row)
                }}
              >
                {t("rentals.bookingPolicy.categories.save")}
              </Button>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
