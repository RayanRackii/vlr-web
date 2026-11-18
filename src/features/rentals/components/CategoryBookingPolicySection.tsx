import { useTranslation } from "react-i18next"

import { FormSection } from "@/components/ui/form-layout"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { useCategoryBookingPolicies } from "@/features/rentals/lib/useCategoryBookingPolicies"
import {
  BOOKING_HORIZON_DAY_MAX,
  CANCEL_CUTOFF_HOURS_MAX,
  parseOptionalWholeNumber,
} from "@/features/rentals/schemas/bookingPolicySchemas"

type CategoryPolicies = ReturnType<typeof useCategoryBookingPolicies>

/** Category exceptions as an inline table; saved by the page's single SaveBar. */
export function CategoryBookingPolicySection({
  canEdit,
  saving,
  policies,
  inheritedDays,
  inheritedHours,
}: {
  canEdit: boolean
  saving: boolean
  policies: CategoryPolicies
  /** Text of the general rule, shown as the placeholder of a blank cell. */
  inheritedDays: string
  inheritedHours: string
}) {
  const { t } = useTranslation()
  const { rows, draftOf, setDraft } = policies

  if (rows === null) return null

  const disabled = !canEdit || saving
  const placeholder = (value: string) => t("rentals.bookingPolicy.categories.inherit", { value })

  return (
    <div data-testid="category-booking-policy">
      <FormSection
        title={t("rentals.bookingPolicy.categories.title")}
        description={t("rentals.bookingPolicy.categories.description")}
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("rentals.bookingPolicy.categories.empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rentals.bookingPolicy.categories.category")}</TableHead>
                <TableHead>{t("rentals.bookingPolicy.categories.horizonDays")}</TableHead>
                <TableHead>{t("rentals.bookingPolicy.categories.cancelCutoffHours")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const draft = draftOf(row)
                const daysInvalid =
                  parseOptionalWholeNumber(draft.days, BOOKING_HORIZON_DAY_MAX) === undefined
                const hoursInvalid =
                  parseOptionalWholeNumber(draft.hours, CANCEL_CUTOFF_HOURS_MAX) === undefined
                return (
                  <TableRow key={row.categoryId} data-testid={`category-policy-${row.categoryId}`}>
                    <TableCell className="font-medium">{row.categoryName}</TableCell>
                    <TableCell>
                      <Input
                        className="min-h-11 w-36 tabular-nums"
                        inputMode="numeric"
                        aria-label={`${row.categoryName}: ${t("rentals.bookingPolicy.categories.horizonDays")}`}
                        aria-invalid={daysInvalid || undefined}
                        value={draft.days}
                        placeholder={placeholder(inheritedDays)}
                        disabled={disabled}
                        onChange={(event) => setDraft(row, { days: event.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-h-11 w-36 tabular-nums"
                        inputMode="numeric"
                        aria-label={`${row.categoryName}: ${t("rentals.bookingPolicy.categories.cancelCutoffHours")}`}
                        aria-invalid={hoursInvalid || undefined}
                        value={draft.hours}
                        placeholder={placeholder(inheritedHours)}
                        disabled={disabled}
                        onChange={(event) => setDraft(row, { hours: event.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {policies.invalid ? (
          <p role="alert" className="text-xs text-destructive">
            {t("rentals.bookingPolicy.categories.invalid")}
          </p>
        ) : null}
      </FormSection>
    </div>
  )
}
