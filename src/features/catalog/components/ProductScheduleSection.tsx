import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { resourceAssistantPath } from "@/features/assistant/paths"
import { CatalogProductResourceRequirements } from "@/features/catalog/components/CatalogProductResourceRequirements"
import { listAdminRentalAssets, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"

export function ResourceLinks({ assets }: { assets: readonly { id: string; name: string }[] }) {
  const { t } = useTranslation()
  return (
    <section aria-label={t("assistant.resourceTitle")} className="space-y-2">
      <h3 className="text-sm font-semibold">{t("assistant.resourceTitle")}</h3>
      {assets.length === 0 ? <p className="text-sm text-muted-foreground">{t("assistant.audienceEmpty")}</p> : assets.map((asset) => (
        <div key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <p className="text-sm font-medium">{asset.name}</p>
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={resourceAssistantPath(asset.id)}>{t("assistant.openResource")}</Link>
        </div>
      ))}
    </section>
  )
}

export function QueueSummary({ assets }: { assets: readonly Pick<AdminRentalAsset, "id" | "name" | "queueEnabled" | "queueOpeningTime">[] }) {
  const { t } = useTranslation()
  if (assets.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("assistant.followsQueue")}</p>
  }
  return (
    <ul className="space-y-2">
      {assets.map((asset) => (
        <li key={asset.id} className="text-sm">
          {asset.name}: {asset.queueEnabled ? t("assistant.queueOnSummary") : t("assistant.queueOffSummary")}
          {asset.queueEnabled && asset.queueOpeningTime ? ` · ${asset.queueOpeningTime.slice(0, 5)}` : ""}
        </li>
      ))}
    </ul>
  )
}

type ProductScheduleSectionProps = {
  productId: string
  linkedAssetIds: readonly string[]
  readOnly: boolean
  onDirtyChange?: (dirty: boolean) => void
  onSavingChange?: (saving: boolean) => void
  onSaved: () => void | Promise<void>
}

/** Resource requirements + linked resources + queue summary for a schedulable product. */
export function ProductScheduleSection({ productId, linkedAssetIds, readOnly, onDirtyChange, onSavingChange, onSaved }: ProductScheduleSectionProps) {
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  useEffect(() => {
    let active = true
    void listAdminRentalAssets().then((rows) => { if (active) setAssets(rows) }).catch(() => { if (active) setAssets([]) })
    return () => { active = false }
  }, [])
  const linkedAssets = assets.filter((asset) => linkedAssetIds.includes(asset.id))
  return (
    <div className="max-w-xl space-y-4">
      <CatalogProductResourceRequirements productId={productId} readOnly={readOnly} onDirtyChange={onDirtyChange} onSavingChange={onSavingChange} onSaved={onSaved} />
      {linkedAssetIds.length > 0 ? <ResourceLinks assets={linkedAssets.length > 0 ? linkedAssets : linkedAssetIds.map((assetId) => ({ id: assetId, name: assetId }))} /> : null}
      <QueueSummary assets={linkedAssets} />
    </div>
  )
}
