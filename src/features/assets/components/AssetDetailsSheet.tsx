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

  return (
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
  )
}
