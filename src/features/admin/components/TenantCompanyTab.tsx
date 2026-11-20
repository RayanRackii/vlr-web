import { useTranslation } from "react-i18next"
import type { UseFormReturn } from "react-hook-form"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status"
import { TenantTextField } from "@/features/admin/components/TenantTextField"
import type { TenantEditFormValues } from "@/features/admin/schemas/adminTenantSchemas"

type TenantCompanyTabProps = {
  form: UseFormReturn<TenantEditFormValues>
  disabled: boolean
  isTrial: boolean
  isTrialReadOnly: boolean
}

/** "Empresa" tab: legal data, contact, address and the read-only trial state. */
export function TenantCompanyTab({
  form,
  disabled,
  isTrial,
  isTrialReadOnly,
}: TenantCompanyTabProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {t("admin.edit.sections.basic")}
          </CardTitle>
          <CardDescription>
            {t("admin.edit.sections.basicDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <TenantTextField
            form={form}
            name="legalName"
            label={t("admin.wizard.fields.legalName")}
            autoComplete="organization"
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="tradeName"
            label={t("admin.edit.company.tradeName")}
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="taxId"
            label={t("admin.wizard.fields.taxId")}
            disabled={disabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {t("admin.edit.company.contactTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.edit.company.contactDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <TenantTextField
            form={form}
            name="contactEmail"
            label={t("admin.edit.company.contactEmail")}
            type="email"
            inputMode="email"
            autoComplete="off"
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="contactPhone"
            label={t("admin.edit.company.contactPhone")}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            disabled={disabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {t("admin.edit.company.addressTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.edit.company.addressDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <TenantTextField
            form={form}
            name="postalCode"
            label={t("admin.edit.company.postalCode")}
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="street"
            label={t("admin.edit.company.street")}
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="number"
            label={t("admin.edit.company.number")}
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="complement"
            label={t("admin.edit.company.complement")}
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="district"
            label={t("admin.edit.company.district")}
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="city"
            label={t("admin.edit.company.city")}
            disabled={disabled}
          />
          <TenantTextField
            form={form}
            name="state"
            label={t("admin.edit.company.state")}
            maxLength={2}
            disabled={disabled}
            transform={(value) => value.toUpperCase()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {t("admin.edit.company.trialTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.edit.company.trialDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {isTrial ? (
            <StatusBadge tone={isTrialReadOnly ? "danger" : "warning"}>
              {isTrialReadOnly
                ? t("admin.edit.status.trialEnded")
                : t("admin.edit.status.trial")}
            </StatusBadge>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {!isTrial
              ? t("admin.edit.company.trialNone")
              : isTrialReadOnly
                ? t("admin.edit.company.trialEnded")
                : t("admin.edit.company.trialActive")}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
