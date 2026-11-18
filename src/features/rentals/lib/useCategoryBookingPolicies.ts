import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

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

export type CategoryPolicyDraft = { days: string; hours: string }

const toDraft = (policy: CategoryBookingPolicy): CategoryPolicyDraft => ({
  days: policy.maxAdvanceBookingDays?.toString() ?? "",
  hours: policy.cancelCutoffHours?.toString() ?? "",
})

const isDraftValid = (draft: CategoryPolicyDraft) =>
  parseOptionalWholeNumber(draft.days, BOOKING_HORIZON_DAY_MAX) !== undefined &&
  parseOptionalWholeNumber(draft.hours, CANCEL_CUTOFF_HOURS_MAX) !== undefined

export type CategoryPolicySaveResult = {
  saved: number
  /** Names of the categories whose save was rejected. */
  failed: string[]
}

/**
 * Owns the category layer (resource override > category > general rule): the rows,
 * the inline drafts and the save of the changed rows, so the page can save
 * everything with a single SaveBar.
 */
export function useCategoryBookingPolicies() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<CategoryBookingPolicy[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, CategoryPolicyDraft>>({})

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

  const draftOf = useCallback(
    (row: CategoryBookingPolicy) => drafts[row.categoryId] ?? toDraft(row),
    [drafts],
  )

  const changedRows = useMemo(
    () =>
      (rows ?? []).filter((row) => {
        const draft = drafts[row.categoryId]
        if (!draft) return false
        const stored = toDraft(row)
        return draft.days !== stored.days || draft.hours !== stored.hours
      }),
    [rows, drafts],
  )
  const invalid = changedRows.some((row) => !isDraftValid(draftOf(row)))

  const setDraft = useCallback((row: CategoryBookingPolicy, patch: Partial<CategoryPolicyDraft>) => {
    setDrafts((current) => ({
      ...current,
      [row.categoryId]: { ...(current[row.categoryId] ?? toDraft(row)), ...patch },
    }))
  }, [])

  const discard = useCallback(() => {
    setDrafts(Object.fromEntries((rows ?? []).map((row) => [row.categoryId, toDraft(row)])))
  }, [rows])

  /** Saves every changed row; a failed row stays dirty and is reported by name. */
  const saveChanged = useCallback(async (): Promise<CategoryPolicySaveResult> => {
    const result: CategoryPolicySaveResult = { saved: 0, failed: [] }
    for (const row of changedRows) {
      const draft = draftOf(row)
      const days = parseOptionalWholeNumber(draft.days, BOOKING_HORIZON_DAY_MAX)
      const hours = parseOptionalWholeNumber(draft.hours, CANCEL_CUTOFF_HOURS_MAX)
      if (days === undefined || hours === undefined) {
        result.failed.push(row.categoryName)
        continue
      }
      try {
        const updated = await replaceCategoryBookingPolicy(row.categoryId, {
          maxAdvanceBookingDays: days,
          cancelCutoffHours: hours,
        })
        result.saved += 1
        setRows((current) =>
          (current ?? []).map((item) => (item.categoryId === updated.categoryId ? updated : item)),
        )
        setDrafts((current) => ({ ...current, [updated.categoryId]: toDraft(updated) }))
      } catch {
        result.failed.push(row.categoryName)
      }
    }
    return result
  }, [changedRows, draftOf])

  return {
    rows,
    draftOf,
    setDraft,
    dirtyCount: changedRows.length,
    invalid,
    discard,
    saveChanged,
  }
}

