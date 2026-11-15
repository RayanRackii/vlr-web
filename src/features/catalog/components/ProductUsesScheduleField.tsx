import { useTranslation } from "react-i18next"

import { SegmentedControl } from "@/components/ui/segmented-control"

type ProductUsesScheduleFieldProps = {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

/** "Este produto usa a agenda?" Sim / Não. Shared by the cadastro steps and the product editor. */
export function ProductUsesScheduleField({ value, onChange, disabled }: ProductUsesScheduleFieldProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("cadastro.product.usesScheduleLabel")}</p>
      <SegmentedControl<"yes" | "no">
        label={t("cadastro.product.usesScheduleLabel")}
        value={value ? "yes" : "no"}
        disabled={disabled}
        className="h-auto w-full flex-col items-stretch sm:w-fit sm:flex-row [&>button]:min-h-11 [&>button]:whitespace-normal"
        options={[
          { value: "yes", label: t("cadastro.product.usesScheduleYes") },
          { value: "no", label: t("cadastro.product.usesScheduleNo") },
        ]}
        onChange={(next) => onChange(next === "yes")}
      />
      <p className="text-xs text-muted-foreground">{t("cadastro.product.usesScheduleHelp")}</p>
    </div>
  )
}
