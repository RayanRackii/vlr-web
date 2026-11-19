import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AssetAttributesSummary } from "@/features/assets/components/AssetAttributesSummary"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Asset } from "@/features/assets/schemas/assetSchemas"
import { AssetAvailabilityDialog } from "@/features/planning/components/AssetAvailabilityDialog"
import { canEditAvailability } from "@/features/planning/model/availabilityAccess"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

type AssetDetailsSheetProps = {
  asset: (Asset & { categoryName: string }) | null
  family: AssetFamily | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Shown only when the user may edit; opens the edit wizard. */
  onEdit?: (assetId: string) => void
}

/** Read-only details of one equipment row: identity fields plus the family attributes. */
export function AssetDetailsSheet({ asset, family, open, onOpenChange, onEdit }: AssetDetailsSheetProps) {
  const { t } = useTranslation()
  const empty = t("assets.inventory.emptyValue")
  const { activeModules, can } = usePermissions()
  // Planning availability lives in the Resource planning module: hidden when it is off or the viewer may not edit it.
  const showAvailability = canEditAvailability(activeModules, can)
  // The dialog outlives the sheet: opening it closes the sheet so two modal layers never stack.
  const [availabilityTarget, setAvailabilityTarget] = useState<{ id: string; name: string } | null>(null)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          {asset ? (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle className="[overflow-wrap:anywhere]">{asset.name}</SheetTitle>
                <SheetDescription className="[overflow-wrap:anywhere]">{asset.tag}</SheetDescription>
              </SheetHeader>
              <div className="min-w-0 space-y-4 px-4">
                <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs text-muted-foreground">{t("assets.inventory.columns.category")}</dt>
                    <dd className="text-sm [overflow-wrap:anywhere]">{asset.categoryName}</dd>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs text-muted-foreground">{t("assets.inventory.columns.location")}</dt>
                    <dd className="text-sm [overflow-wrap:anywhere]">{asset.location || empty}</dd>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs text-muted-foreground">{t("assets.inventory.columns.status")}</dt>
                    <dd className="text-sm">
                      <Badge variant="secondary">{t(`assets.inventory.status.${asset.status}`)}</Badge>
                    </dd>
                  </div>
                </dl>
                <section aria-labelledby="asset-details-attributes" className="min-w-0 space-y-2 border-t border-border pt-4">
                  <h3 id="asset-details-attributes" className="text-sm font-semibold">
                    {t("assets.attributes.title")}
                  </h3>
                  <AssetAttributesSummary fields={family?.fields ?? []} attributes={asset.attributes} />
                </section>
                {showAvailability ? (
                  <section aria-labelledby="asset-details-availability" className="min-w-0 space-y-2 border-t border-border pt-4">
                    <h3 id="asset-details-availability" className="text-sm font-semibold">
                      {t("planning.availability.section")}
                    </h3>
                    <p className="text-xs text-muted-foreground">{t("planning.availability.sectionHint")}</p>
                    <Button type="button" variant="outline" className="touch-target min-h-11" onClick={() => { setAvailabilityTarget({ id: asset.id, name: asset.name }); onOpenChange(false) }}>
                      {t("planning.availability.open")}
                    </Button>
                  </section>
                ) : null}
              </div>
              {onEdit ? (
                <SheetFooter>
                  <Button type="button" onClick={() => onEdit(asset.id)}>
                    {t("assets.actions.edit")}
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      {showAvailability ? (
        <AssetAvailabilityDialog
          assetId={availabilityTarget?.id ?? null}
          assetName={availabilityTarget?.name ?? ""}
          onOpenChange={(next) => { if (!next) setAvailabilityTarget(null) }}
        />
      ) : null}
    </>
  )
}
