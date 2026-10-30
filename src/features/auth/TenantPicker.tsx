import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
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
  const searchId = useId()
  const [query, setQuery] = useState("")
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId)
  const [submitting, setSubmitting] = useState(false)
  const search = normalizeSearch(query.trim())
  const filteredMemberships = memberships.filter((membership) =>
    normalizeSearch([membership.tradeName, membership.legalName, membership.subdomain].join(" ")).includes(search),
  )
  const selected = filteredMemberships.some(
    (membership) => membership.tenantId === selectedTenantId,
  )

  return (
    <form
      className="w-full min-w-0 space-y-5"
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
      {memberships.length > 6 ? (
        <div className="space-y-2">
          <Label htmlFor={searchId}>{t("auth.invite.pickerSearch")}</Label>
          <Input
            id={searchId}
            type="search"
            className="h-11"
            value={query}
            disabled={submitting}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}

      <fieldset className="min-w-0">
        <legend className="sr-only">{t("auth.invite.pickerTitle")}</legend>
        <ul className="max-h-[min(24rem,50dvh)] space-y-2 overflow-y-auto p-1">
          {filteredMemberships.map((membership) => {
            const label = membershipLabel(membership)
            const secondary = membershipSecondary(membership)
            return (
              <li key={membership.tenantId}>
                <label className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm motion-safe:transition-colors hover:border-primary/50 hover:bg-accent focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
                  <input
                    type="radio"
                    name="tenant-picker"
                    className="size-4 shrink-0 accent-primary"
                    value={membership.tenantId}
                    checked={selectedTenantId === membership.tenantId}
                    disabled={submitting}
                    onChange={() => {
                      setSelectedTenantId(membership.tenantId)
                    }}
                  />
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {label.charAt(0).toLocaleUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]">
                    <span className="block font-medium">{label}</span>
                    {secondary ? (
                      <span className="block text-xs leading-relaxed text-muted-foreground">{secondary}</span>
                    ) : null}
                    {membership.subdomain ? (
                      <span className="block text-xs leading-relaxed text-muted-foreground">{membership.subdomain}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {filteredMemberships.length === 0 ? (
          <p role="status" className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t(memberships.length === 0 ? "auth.invite.pickerEmpty" : "auth.invite.pickerNoResults")}
          </p>
        ) : null}
      </fieldset>

      <FormPrimaryButton
        type="submit"
        className="touch-target min-h-11 w-full whitespace-normal"
        isValid={selected}
        loading={submitting}
        loadingLabel={t("auth.invite.pickerSubmitting")}
      >
        {t("auth.invite.pickerSubmit")}
      </FormPrimaryButton>
    </form>
  )
}
