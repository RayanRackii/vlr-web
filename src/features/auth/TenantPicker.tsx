import { useState } from "react"
import { useTranslation } from "react-i18next"

import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import type { StaffTenantMembership } from "@/features/users/schemas/staffTenantSchemas"

function membershipLabel(membership: StaffTenantMembership): string {
  const trade = membership.tradeName?.trim() ?? ""
  if (trade.length > 0) {
    return trade
  }

  return membership.legalName
}

function membershipSecondary(membership: StaffTenantMembership): string | null {
  const trade = membership.tradeName?.trim() ?? ""
  if (trade.length === 0 || trade === membership.legalName) {
    return null
  }

  return membership.legalName
}

export function TenantPicker({
  memberships,
  initialTenantId,
  onConfirm,
}: {
  memberships: StaffTenantMembership[]
  initialTenantId: string
  onConfirm: (tenantId: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId)
  const [submitting, setSubmitting] = useState(false)
  const selected = memberships.some(
    (membership) => membership.tenantId === selectedTenantId,
  )

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!selected || submitting) {
          return
        }

        setSubmitting(true)
        void onConfirm(selectedTenantId).finally(() => {
          setSubmitting(false)
        })
      }}
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">{t("auth.invite.pickerTitle")}</legend>
        {memberships.map((membership) => {
          const label = membershipLabel(membership)
          const secondary = membershipSecondary(membership)
          return (
            <label
              key={membership.tenantId}
              className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <input
                type="radio"
                name="tenant-picker"
                className="mt-0.5 size-4 accent-primary"
                value={membership.tenantId}
                checked={selectedTenantId === membership.tenantId}
                disabled={submitting}
                onChange={() => {
                  setSelectedTenantId(membership.tenantId)
                }}
              />
              <span>
                <span className="block font-medium">{label}</span>
                {secondary ? (
                  <span className="block text-muted-foreground">{secondary}</span>
                ) : null}
              </span>
            </label>
          )
        })}
      </fieldset>

      <FormPrimaryButton
        type="submit"
        className="w-full"
        isValid={selected}
        loading={submitting}
        loadingLabel={t("auth.invite.pickerSubmitting")}
      >
        {t("auth.invite.pickerSubmit")}
      </FormPrimaryButton>
    </form>
  )
}
