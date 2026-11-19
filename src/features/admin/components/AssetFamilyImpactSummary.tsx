import { useTranslation } from "react-i18next"

import {
  isAttentionRow,
  type AdminAssetFamilySchemaPreview,
} from "@/features/admin/schemas/adminAssetFamilySchemas"

type AssetFamilyImpactSummaryProps = {
  preview: AdminAssetFamilySchemaPreview
  /** Field key -> label shown to the admin; falls back to the key. */
  labelFor: (key: string) => string
  /** Only rows that block or need attention are listed. */
  only: "blocking" | "attention"
}

export function AssetFamilyImpactSummary({
  preview,
  labelFor,
  only,
}: AssetFamilyImpactSummaryProps) {
  const { t } = useTranslation()
  const rows = preview.fields.filter((row) =>
    only === "blocking" ? row.blocking : isAttentionRow(row) || row.blocking,
  )

  return (
    <ul className="space-y-3 text-sm" aria-label={t("admin.assetFamilies.impact.listLabel")}>
      {rows.map((row) => (
        <li key={row.key} className="space-y-1 rounded-lg border border-border p-3">
          <p className="font-medium [overflow-wrap:anywhere]">
            {labelFor(row.key)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {t(`admin.assetFamilies.impact.change.${row.change}`, {
                defaultValue: row.change,
              })}
            </span>
          </p>
          {row.assetCount > 0 ? (
            <p className="text-muted-foreground">
              {t("admin.assetFamilies.impact.usage", {
                count: row.assetCount,
                tenants: row.tenantCount,
              })}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {t("admin.assetFamilies.impact.unused")}
            </p>
          )}
          {row.incompatibleCount > 0 ? (
            <p className="text-destructive">
              {t("admin.assetFamilies.impact.incompatible", {
                count: row.incompatibleCount,
              })}
              {row.incompatibleSamples.length > 0
                ? ` ${t("admin.assetFamilies.impact.samples", {
                    samples: row.incompatibleSamples
                      .map((sample) => `"${sample}"`)
                      .join(", "),
                  })}`
                : ""}
            </p>
          ) : null}
          {row.constraintViolationCount > 0 ? (
            <p className="text-warning-foreground">
              {t("admin.assetFamilies.impact.constraintViolations", {
                count: row.constraintViolationCount,
              })}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
