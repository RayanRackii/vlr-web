import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  buildSellableChecklist,
  sellableSummary,
  type ResourceCapability,
  type SellableAccess,
  type SellableChecklistItem,
  type SellableRequirement,
  type SellableSummary,
} from "@/features/catalog/components/productWizard/sellableChecklist"
import { productWizardPath } from "@/features/catalog/components/productWizard/wizardSteps"
import { isCatalogModuleName } from "@/features/catalog/customerNav"
import type { CatalogProduct, CustomerGroup } from "@/features/catalog/schemas/catalogSchemas"
import {
  getCatalogProduct,
  getCatalogProductAccess,
  getCatalogProductResourceRequirements,
  listCustomerGroups,
} from "@/features/catalog/services/catalogService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  createModuleMenuItem,
  listTenantModuleMenuItems,
  updateModuleMenuItem,
} from "@/features/tenantPortal/services/tenantPortalService"
import i18n from "@/lib/i18n"

function isModuleInactiveError(error: unknown): boolean {
  return error instanceof Error && error.message === i18n.t("apiErrors.moduleInactive")
}

export type ProductWizardModel = {
  product: CatalogProduct
  access: SellableAccess | null
  groups: readonly CustomerGroup[] | null
  menuItems: readonly ModuleMenuItem[] | null
  requirements: readonly SellableRequirement[] | null
  resourceCapability: ResourceCapability
}

export function useProductWizard(productId: string) {
  const { t } = useTranslation()
  const { can, activeModules } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const readOnly = isTrialReadOnly
  const rentalsActive = activeModules.some((module) => module.trim().toLowerCase() === "rentals")
  const [model, setModel] = useState<ProductWizardModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const active = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const menuRead = can("core.module_menu.read")
      const [product, accessResult, groupsResult, menuResult, resourceResult] = await Promise.all([
        getCatalogProduct(productId),
        getCatalogProductAccess(productId).then(
          (access) => ({ access, failed: false }),
          () => ({ access: null, failed: true }),
        ),
        listCustomerGroups().then(
          (groups) => ({ groups, failed: false }),
          () => ({ groups: null, failed: true }),
        ),
        menuRead
          ? listTenantModuleMenuItems().then(
            (items) => ({ items, failed: false }),
            () => ({ items: null, failed: true }),
          )
          : Promise.resolve({ items: null, failed: true }),
        rentalsActive
          ? getCatalogProductResourceRequirements(productId).then(
            (data) => ({ requirements: data.requirements, capability: "ready" as const }),
            (error: unknown) => ({
              requirements: null,
              capability: (isModuleInactiveError(error) ? "inactive" : "unknown") as ResourceCapability,
            }),
          )
          : Promise.resolve({ requirements: null, capability: "unknown" as const }),
      ])
      if (!active.current) {
        return
      }
      setModel({
        product,
        access: accessResult.failed ? null : {
          visibility: accessResult.access?.visibility ?? "Public",
          customerIds: accessResult.access?.customerIds ?? [],
          groupIds: accessResult.access?.groupIds ?? [],
        },
        groups: groupsResult.failed ? null : groupsResult.groups,
        menuItems: menuResult.failed ? null : menuResult.items,
        requirements: resourceResult.requirements,
        resourceCapability: resourceResult.capability,
      })
      setError(null)
    } catch (loadError) {
      if (!active.current) {
        return
      }
      setModel(null)
      setError(loadError instanceof Error ? loadError.message : t("apiErrors.loadCatalogProduct"))
    } finally {
      if (!silent && active.current) {
        setLoading(false)
      }
    }
  }, [can, productId, rentalsActive, t])

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

  const permissions = useMemo(() => ({
    menuRead: can("core.module_menu.read"),
    menuWrite: can("core.module_menu.write") && !readOnly,
  }), [can, readOnly])

  const checklist = useMemo(() => {
    if (!model) {
      return []
    }
    return buildSellableChecklist({
      product: {
        id: model.product.id,
        isActive: model.product.isActive,
        visibility: model.product.visibility ?? "Public",
      },
      access: model.access,
      groups: model.groups,
      menuItems: model.menuItems,
      requirements: model.requirements,
      resourceCapability: model.resourceCapability,
      rentalsActive,
      permissions,
    })
  }, [model, permissions, rentalsActive])

  const summary: SellableSummary = model
    ? sellableSummary(model.product.isActive, checklist)
    : "unknown"

  async function publishMenu() {
    if (!model || busyAction) {
      return
    }
    setBusyAction("menu")
    try {
      const items = model.menuItems ?? []
      const inactive = items.find((item) => !item.isActive && isCatalogModuleName(item.moduleName))
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
          moduleName: "catalog",
          label: t("admin.moduleMenu.suggestedLabelCatalog"),
          sortOrder,
          isActive: true,
        })
      }
      toast.success(t("catalog.productWizard.menuPublished"))
      await load(true)
    } catch (publishError) {
      toast.error(publishError instanceof Error ? publishError.message : t("apiErrors.createMenuItem"))
    } finally {
      setBusyAction(null)
    }
  }

  return {
    model,
    loading,
    error,
    checklist,
    summary,
    busy: busyAction !== null,
    busyAction,
    readOnly,
    rentalsActive,
    canManage: can("catalog.products.manage") && !readOnly,
    canSearchCustomers: can("core.customers.read"),
    wizardPath: productWizardPath(productId),
    reload: () => load(true),
    publishMenu,
  }
}

export type { SellableChecklistItem }
