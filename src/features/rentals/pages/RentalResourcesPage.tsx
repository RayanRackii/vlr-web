import { useCallback, useEffect, useMemo, useState } from "react"
import { Boxes, DoorOpen, MoreHorizontal, Package, Plus } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { StatusChips } from "@/components/data-table/StatusChips"
import { Page } from "@/components/layout/Page"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import {
  RentalResourceCapacity,
  RentalResourceDurations,
  RentalResourcePrice,
} from "@/features/rentals/components/RentalResourceDetails"
import { menuCoversAsset } from "@/features/rentals/components/resourceWizard/bookableChecklist"
import { resourceWizardPath } from "@/features/rentals/components/resourceWizard/wizardSteps"
import { ItemStatusBadge } from "@/features/assistant/ItemStatusBadge"
import { resourceItemStatus, statusFromServer } from "@/features/assistant/itemStatus"
import { getAssetPricings, type RentalPricing } from "@/features/assets/services/rentalPricingService"
import {
  listAdminRentalAssets,
  listScheduleTemplates,
  type AdminRentalAsset,
  type ScheduleTemplate,
} from "@/features/rentals/services/scheduleService"
import { listTenantModuleMenuItems } from "@/features/tenantPortal/services/tenantPortalService"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { getSetupStatus, type SetupStatus } from "@/features/rentals/services/setupStatusService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { mapRbacErrorMessage } from "@/features/users/permissions/rbacErrors"

type KindFilter = AdminRentalAsset["type"]

type ResourcePrice = Pick<RentalPricing, "pricePerHour" | "pricingUnit">

export function RentalResourcesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()

  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [serverStatus, setServerStatus] = useState<SetupStatus | null>(null)
  const [templates, setTemplates] = useState<ScheduleTemplate[] | null>(null)
  const [menuItems, setMenuItems] = useState<ModuleMenuItem[] | null>(null)
  const [priceByAssetId, setPriceByAssetId] = useState<Record<string, ResourcePrice>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const canWrite = can("rentals.assets.write") && !isTrialReadOnly
  const canReadPricing = can("rentals.pricing.read")
  const canReadSchedule = can("rentals.schedule.read")
  const canReadMenu = can("core.module_menu.read")
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<KindFilter | null>(null)
  const spaceCount = assets.filter((asset) => asset.type === "Location").length
  const itemCount = assets.length - spaceCount
  const filteredAssets = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return assets.filter((asset) =>
      (kind === null || asset.type === kind) &&
      (needle === "" || asset.name.toLocaleLowerCase().includes(needle)))
  }, [assets, kind, search])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [assetList, templateList, menuList] = await Promise.all([
        listAdminRentalAssets(),
        canReadSchedule ? listScheduleTemplates().catch(() => null) : Promise.resolve(null),
        canReadMenu ? listTenantModuleMenuItems().catch(() => null) : Promise.resolve(null),
      ])
      setAssets(assetList)
      setTemplates(templateList)
      setMenuItems(menuList)
      if (canReadPricing) {
        const prices = await Promise.all(assetList.map(async (asset) => {
          try {
            const pricings = await getAssetPricings(asset.assetId)
            const lowestPrice = pricings.filter((pricing) => pricing.pricePerHour > 0).reduce<RentalPricing | null>(
              (lowest, pricing) => lowest === null || pricing.pricePerHour < lowest.pricePerHour ? pricing : lowest,
              null,
            )
            return lowestPrice === null ? null : [asset.assetId, { pricePerHour: lowestPrice.pricePerHour, pricingUnit: lowestPrice.pricingUnit }] as const
          } catch {
            return null
          }
        }))
        setPriceByAssetId(Object.fromEntries(prices.filter((price): price is readonly [string, ResourcePrice] => price !== null)))
      } else {
        setPriceByAssetId({})
      }
    } catch (error) {
      const fallback = t("rentals.resources.loadError")
      const raw =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : fallback
      const message = mapRbacErrorMessage(raw, fallback)
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [canReadMenu, canReadPricing, canReadSchedule, t])

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => { if (current) return load() })
    return () => { current = false }
  }, [load])

  useEffect(() => {
    let current = true
    void getSetupStatus().then((next) => {
      if (current) setServerStatus(next)
    }).catch(() => {
      if (current) setServerStatus(null)
    })
    return () => { current = false }
  }, [])

  function openCreate() {
    navigate("/configuracoes/recursos/cadastro")
  }


  function statusOf(asset: AdminRentalAsset) {
    const server = serverStatus?.resources.find((item) => item.id === asset.id)
    return statusFromServer(server?.state ?? "", server?.missing ?? []) ?? resourceItemStatus({
      name: asset.name,
      isActive: asset.isActive,
      type: asset.type,
      schedulePolicy: asset.schedulePolicy,
      openTime: asset.openTime,
      closeTime: asset.closeTime,
      queueEnabled: asset.queueEnabled,
      queueOpeningTime: asset.queueOpeningTime,
      allowedDurationMinutes: asset.allowedDurationMinutes,
      cancelCutoffHours: asset.cancelCutoffHours,
      menuPublished: menuItems === null ? null : menuItems.some((item) => menuCoversAsset(item, asset.id)),
      hasActiveTemplate: (templates ?? []).some((template) => template.rentalAssetId === asset.id && template.isActive),
      hasPrice: priceByAssetId[asset.assetId] != null,
      directRental: asset.directRental !== false,
    })
  }

  function editPath(asset: AdminRentalAsset) {
    return `/configuracoes/recursos/${encodeURIComponent(asset.id)}`
  }

  function renderResource(asset: AdminRentalAsset) {
    const Icon = asset.type === "Good" ? Package : DoorOpen
    const kindLabel = asset.type === "Good" ? t("rentals.resources.typeGood") : t("rentals.resources.typeLocation")
    const subtitle = [
      kindLabel,
      asset.categoryName,
      asset.type === "Good" ? t("rentals.resources.quantitySummary", { count: asset.totalQuantity }) : null,
      asset.location,
    ].filter(Boolean).join(" · ")
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
          <Icon className="size-5" strokeWidth={ICON_STROKE_WIDTH} />
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={editPath(asset)}
              className="inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 [overflow-wrap:anywhere] hover:underline"
            >
              {asset.name}
            </Link>
            <ItemStatusBadge status={statusOf(asset)} />
            {asset.scheduledDeletionAt ? (
              <Badge variant="destructive">{t("assets.deletion.pendingBadge")}</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>
        </div>
      </div>
    )
  }

  function renderRowActions(asset: AdminRentalAsset) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={t("rentals.resources.rowMenu", { name: asset.name })}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11 py-2.5" onClick={() => { navigate(editPath(asset)) }}>
            {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 py-2.5" onClick={() => { navigate(resourceWizardPath(asset.id)) }}>
            {t("rentals.resourceWizard.open")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function renderPrice(asset: AdminRentalAsset) {
    return (
      <RentalResourcePrice
        pricePerHour={priceByAssetId[asset.assetId]?.pricePerHour}
        pricingUnit={priceByAssetId[asset.assetId]?.pricingUnit}
        showUnpriced={canReadPricing}
      />
    )
  }

  const columns: DataListColumn<AdminRentalAsset>[] = [
    { id: "resource", header: t("rentals.resources.columns.resource"), cell: renderResource },
    { id: "price", header: t("rentals.resources.columns.price"), cell: renderPrice },
    { id: "durations", header: t("rentals.resources.columns.durations"), hideBelow: "lg", cell: (asset) => <RentalResourceDurations asset={asset} /> },
    { id: "capacity", header: t("rentals.resources.columns.capacity"), hideBelow: "lg", cell: (asset) => <RentalResourceCapacity asset={asset} /> },
    {
      id: "actions",
      header: <span className="sr-only">{t("rentals.resources.columns.actions")}</span>,
      align: "end",
      cell: renderRowActions,
    },
  ]

  const hasFilters = search.trim() !== "" || kind !== null

  return (
    <Page
      width="wide"
      header={{
        title: t("rentals.resources.title"),
        description: t("rentals.resources.description"),
        actions: (
          <>
            <Link className={buttonVariants({ variant: "ghost" })} to="/primeiros-passos">
              {t("assistant.firstSteps.title")}
            </Link>
            <Can permission="rentals.assets.write">
              <Button
                type="button"
                disabled={!canWrite || loading || loadError !== null}
                onClick={openCreate}
              >
                <Plus data-icon="inline-start" strokeWidth={ICON_STROKE_WIDTH} />
                {t("rentals.resources.add")}
              </Button>
            </Can>
          </>
        ),
      }}
      {...(loadError !== null && !loading
        ? { state: "error" as const, error: loadError, onRetry: () => { void load() } }
        : { state: "ready" as const })}
    >
      <DataList<AdminRentalAsset>
        state={loading ? "loading" : "ready"}
        label={t("rentals.resources.title")}
        loadingLabel={t("common.loading")}
        columns={columns}
        rows={filteredAssets}
        getRowId={(asset) => asset.id}
        toolbar={assets.length > 0 ? (
          <FilterBar
            label={t("rentals.resources.filters.label")}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: t("rentals.resources.filters.searchPlaceholder"),
              label: t("rentals.resources.filters.searchLabel"),
            }}
            filters={
              <StatusChips<KindFilter>
                label={t("rentals.resources.filters.kind")}
                allLabel={t("rentals.resources.filters.all")}
                allCount={assets.length}
                value={kind}
                onChange={setKind}
                options={[
                  { value: "Location", label: t("rentals.resources.filters.spaces"), count: spaceCount },
                  { value: "Good", label: t("rentals.resources.filters.items"), count: itemCount },
                ]}
              />
            }
          />
        ) : undefined}
        heading={
          <p>
            <strong className="font-semibold text-foreground">{t("rentals.resources.summaryResources", { count: filteredAssets.length })}</strong>
            {t("rentals.resources.summaryBreakdown", {
              spaces: t("rentals.resources.summarySpaces", { count: filteredAssets.filter((asset) => asset.type === "Location").length }),
              items: t("rentals.resources.summaryItems", { count: filteredAssets.filter((asset) => asset.type !== "Location").length }),
            })}
          </p>
        }
        empty={assets.length === 0 ? {
          icon: Boxes,
          title: t("rentals.resources.emptyTitle"),
          description: t("rentals.resources.emptyDescription"),
          action: canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus data-icon="inline-start" strokeWidth={ICON_STROKE_WIDTH} />
              {t("rentals.resources.add")}
            </Button>
          ) : undefined,
        } : {
          icon: Boxes,
          title: t("rentals.resources.filters.emptyTitle"),
          description: hasFilters ? t("rentals.resources.filters.emptyDescription") : undefined,
        }}
        renderCard={(asset) => (
          <>
            <div className="flex min-w-0 items-start justify-between gap-2">
              {renderResource(asset)}
              {renderRowActions(asset)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              {renderPrice(asset)}
              <RentalResourceDurations asset={asset} withLabel />
              <RentalResourceCapacity asset={asset} withLabel />
            </div>
          </>
        )}
      />
    </Page>
  )
}
