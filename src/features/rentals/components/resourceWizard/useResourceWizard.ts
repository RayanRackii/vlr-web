import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ZodError } from "zod"

import { bulkApplyAssetPricings, createAssetPricing, getAssetPricings, type RentalPricing } from "@/features/assets/services/rentalPricingService"
import {
  bookableSummary,
  buildBookableChecklist,
  type BookableSummary,
  type ChecklistItem,
} from "@/features/rentals/components/resourceWizard/bookableChecklist"
import type { WizardPricingUnit } from "@/features/rentals/components/resourceWizard/wizardDrafts"
import { parseWizardPrice } from "@/features/rentals/components/resourceWizard/wizardDrafts"
import { resourceWizardPath } from "@/features/rentals/components/resourceWizard/wizardSteps"
import { buildRentalResourceFormValues } from "@/features/rentals/components/rentalResourceFormDefaults"
import { toCreateRentableRequest } from "@/features/rentals/schemas/rentalResourceSchemas"
import { updateRentalAsset } from "@/features/rentals/services/rentalResourcesService"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import {
  createOccupancyKind,
  DAY_NAMES,
  listAdminRentalAssets,
  listOccupancyKinds,
  listScheduleTemplates,
  normalizeScheduleTime,
  seedDefaultHourlyTemplates,
  updateOccupancyKind,
  updateRentalSchedulePolicy,
  type AdminRentalAsset,
  type OccupancyKind,
  type ScheduleTemplate,
  type UpdateSchedulePolicyInput,
} from "@/features/rentals/services/scheduleService"
import {
  createModuleMenuItem,
  listTenantModuleMenuItems,
  updateModuleMenuItem,
} from "@/features/tenantPortal/services/tenantPortalService"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

type WizardModel = {
  asset: AdminRentalAsset
  menuItems: ModuleMenuItem[] | null
  kinds: OccupancyKind[] | null
  templates: ScheduleTemplate[] | null
  prices: RentalPricing[] | null
}

export function useResourceWizard(rentalAssetId: string) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const [model, setModel] = useState<WizardModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<ScheduleBusyAction | "menu" | "kind" | "price" | "queue" | null>(null)
  const wizardPath = resourceWizardPath(rentalAssetId)
  const readOnlyTrial = isTrialReadOnly
  const active = useRef(true)

  const access = useMemo(() => ({
    menuRead: can("core.module_menu.read"),
    menuWrite: can("core.module_menu.write") && !readOnlyTrial,
    kindsRead: can("rentals.occupancy_kinds.read"),
    kindsWrite: can("rentals.occupancy_kinds.write") && !readOnlyTrial,
    scheduleRead: can("rentals.schedule.read"),
    scheduleWrite: can("rentals.schedule.write") && !readOnlyTrial,
    pricingRead: can("rentals.pricing.read"),
    pricingWrite: (can("rentals.pricing.write") || can("rentals.pricing.bulk_write")) && !readOnlyTrial,
    pricingReplace: can("rentals.pricing.bulk_write") && !readOnlyTrial,
    assetWrite: can("rentals.assets.write") && !readOnlyTrial,
    reservationsRead: can("rentals.reservations.read"),
  }), [can, readOnlyTrial])

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [assets, menuItems, kinds, templates] = await Promise.all([
        listAdminRentalAssets(),
        access.menuRead ? listTenantModuleMenuItems().catch(() => null) : Promise.resolve(null),
        access.kindsRead ? listOccupancyKinds().catch(() => null) : Promise.resolve(null),
        access.scheduleRead ? listScheduleTemplates(rentalAssetId).catch(() => null) : Promise.resolve(null),
      ])
      const asset = assets.find((entry) => entry.id === rentalAssetId)
      if (!asset) {
        throw new Error(t("rentals.resourceWizard.notFound"))
      }
      const prices = access.pricingRead
        ? await getAssetPricings(asset.assetId).catch(() => null)
        : null
      if (!active.current) {
        return
      }
      setModel({ asset, menuItems, kinds, templates, prices })
      setError(null)
    } catch (loadError) {
      if (!active.current) {
        return
      }
      const message = loadError instanceof Error ? loadError.message : t("rentals.resources.loadError")
      if (silent) {
        toast.error(message)
      } else {
        setModel(null)
        setError(message)
      }
    } finally {
      if (!silent && active.current) {
        setLoading(false)
      }
    }
  }, [access.kindsRead, access.menuRead, access.pricingRead, access.scheduleRead, rentalAssetId, t])

  useEffect(() => {
    active.current = true
    void Promise.resolve().then(() => {
      if (active.current) {
        void load(false)
      }
    })
    return () => {
      active.current = false
    }
  }, [load])

  const checklist = useMemo(() => {
    if (!model) {
      return []
    }
    return buildBookableChecklist({
      asset: model.asset,
      menuItems: model.menuItems,
      kinds: model.kinds,
      templates: model.templates,
      prices: model.prices,
      access,
      wizardPath,
    })
  }, [access, model, wizardPath])

  const summary: BookableSummary = model
    ? bookableSummary(model.asset.isActive, checklist)
    : "unknown"

  async function run(action: NonNullable<typeof busyAction>, work: () => Promise<void>) {
    if (busyAction) {
      return
    }
    setBusyAction(action)
    try {
      await work()
      await load(true)
    } catch (workError) {
      const message = workError instanceof ZodError
        ? t("rentals.resources.updateError")
        : workError instanceof Error
          ? workError.message
          : t("rentals.resources.updateError")
      toast.error(message)
    } finally {
      setBusyAction(null)
    }
  }

  function publishMenu() {
    const asset = model?.asset
    const items = model?.menuItems ?? []
    if (!asset) {
      return
    }
    void run("menu", async () => {
      const inactive = items.find((item) =>
        !item.isActive &&
        item.moduleName.trim().toLowerCase() === "rentals" &&
        (item.rentalAssetId == null || item.rentalAssetId === asset.id),
      )
      if (inactive) {
        await updateModuleMenuItem(inactive.id, {
          label: inactive.label,
          sortOrder: inactive.sortOrder,
          isActive: true,
          rentalAssetId: inactive.rentalAssetId ?? null,
        })
      } else {
        const sortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1
        await createModuleMenuItem({
          moduleName: "rentals",
          label: t("admin.moduleMenu.suggestedLabelRentals"),
          sortOrder,
          isActive: true,
        })
      }
      toast.success(t("rentals.resourceWizard.menuPublished"))
    })
  }

  function createKind() {
    void run("kind", async () => {
      const existing = model?.kinds?.find((kind) => kind.key === "bookable")
      if (existing) {
        await updateOccupancyKind(existing.id, {
          key: existing.key,
          label: existing.label,
          description: existing.description ?? null,
          colorHex: existing.colorHex ?? null,
          iconKey: existing.iconKey ?? null,
          isBookableByCustomer: true,
          blocksCapacity: existing.blocksCapacity,
          sortOrder: existing.sortOrder,
          isActive: true,
        })
      } else {
        await createOccupancyKind({
          key: "bookable",
          label: t("rentals.resourceWizard.defaultKindLabel"),
          description: null,
          colorHex: "#3B82F6",
          iconKey: "calendar",
          isBookableByCustomer: true,
          blocksCapacity: false,
          sortOrder: 10,
          isActive: true,
        })
      }
      toast.success(t("rentals.resourceWizard.kindCreated"))
    })
  }

  function savePolicy(input: UpdateSchedulePolicyInput) {
    const asset = model?.asset
    if (!asset) {
      return Promise.resolve()
    }
    return run("policy", async () => {
      await updateRentalSchedulePolicy(asset.id, input)
      toast.success(t(input.schedulePolicy === "OpenHours"
        ? "rentals.schedule.policy.saveOpenHoursSuccess"
        : "rentals.schedule.policy.saveSlotGridSuccess"))
    })
  }

  function seedTemplates() {
    const asset = model?.asset
    if (!asset) {
      return
    }
    void run("seed", async () => {
      const created = await seedDefaultHourlyTemplates(asset.id)
      toast.success(t("rentals.schedule.seedSuccess", { count: created }))
    })
  }

  function savePrices(draft: { amount: string; pricingUnit: WizardPricingUnit; startTime: string; endTime: string }) {
    const asset = model?.asset
    const amount = parseWizardPrice(draft.amount)
    if (!asset || amount === null) {
      return Promise.resolve()
    }
    return run("price", async () => {
      const rows = DAY_NAMES.map((dayOfWeek) => ({
        dayOfWeek,
        startTime: normalizeScheduleTime(draft.startTime),
        endTime: normalizeScheduleTime(draft.endTime),
        pricePerHour: amount,
        pricingUnit: draft.pricingUnit,
        requiresDeposit: asset.requiresDeposit,
        depositPercentage: 0,
      }))
      if (access.pricingReplace) {
        await bulkApplyAssetPricings({ assetIds: [asset.assetId], pricings: rows, replace: true })
      } else {
        for (const row of rows) {
          await createAssetPricing(asset.assetId, row)
        }
      }
      toast.success(t("rentals.resourceWizard.prices.saved"))
    })
  }

  function saveQueue(enabled: boolean, openingTime: string) {
    const asset = model?.asset
    if (!asset) {
      return Promise.resolve()
    }
    return run("queue", async () => {
      const values = {
        ...buildRentalResourceFormValues(asset, [], [], []),
        queueEnabled: asset.type === "Location" && enabled,
        queueOpeningTime: asset.type === "Location" && enabled ? openingTime : "",
      }
      const body = toCreateRentableRequest(values, {
        creating: false,
        stored: asset.maxAdvanceBookingDays,
        storedVisualTemplateRevisionId: asset.visualTemplateRevisionId,
        storedCapacityPeople: asset.capacityPeople,
      })
      await updateRentalAsset(asset.id, body)
      toast.success(t("rentals.resourceWizard.prices.queueSaved"))
    })
  }

  return {
    loading,
    error,
    reload: load,
    model,
    checklist,
    summary,
    wizardPath,
    access,
    busy: busyAction !== null,
    busyAction: busyAction === "policy" || busyAction === "seed" ? busyAction : null,
    publishMenu,
    createKind,
    savePolicy,
    seedTemplates,
    savePrices,
    saveQueue,
  }
}

export type { ChecklistItem }
