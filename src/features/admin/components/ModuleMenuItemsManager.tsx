import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { MODULE_KEYS } from "@/features/admin/schemas/adminTenantSchemas"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  createModuleMenuItem,
  deleteModuleMenuItem,
  fetchPortalRentalAssets,
  listAdminModuleMenuItems,
  listTenantModuleMenuItems,
  type PortalRentalAsset,
} from "@/features/tenantPortal/services/tenantPortalService"
import { api } from "@/lib/api"

type ModuleMenuItemsManagerProps = {
  /** Platform-admin context for a specific tenant. */
  tenantId?: string
  /** Subdomain used to load public rental assets (platform admin). */
  subdomain?: string | null
}

function toCanonicalModule(moduleKey: string): string {
  switch (moduleKey) {
    case "Rentals":
      return "rentals"
    case "Inventory":
      return "inventory"
    case "PMOC":
      return "pmoc"
    case "OS":
      return "os"
    default:
      return moduleKey.toLowerCase()
  }
}

export function ModuleMenuItemsManager({
  tenantId,
  subdomain,
}: ModuleMenuItemsManagerProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<ModuleMenuItem[]>([])
  const [assets, setAssets] = useState<PortalRentalAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState("")
  const [moduleKey, setModuleKey] = useState<string>("Rentals")
  const [rentalAssetId, setRentalAssetId] = useState("")

  async function loadAssets() {
    try {
      if (tenantId && subdomain) {
        const list = await fetchPortalRentalAssets(subdomain)
        setAssets(list)
        return
      }
      if (!tenantId) {
        const response = await api.get("/api/rental-assets")
        const list = Array.isArray(response.data)
          ? (response.data as PortalRentalAsset[])
          : []
        setAssets(list)
      }
    } catch {
      setAssets([])
    }
  }

  async function reload() {
    setLoading(true)
    try {
      const data = tenantId
        ? await listAdminModuleMenuItems(tenantId)
        : await listTenantModuleMenuItems()
      setItems(data)
      await loadAssets()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.moduleMenu.loadError"),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, subdomain])

  async function handleCreate() {
    if (label.trim().length === 0) {
      return
    }
    setSaving(true)
    try {
      await createModuleMenuItem(
        {
          moduleName: toCanonicalModule(moduleKey),
          label: label.trim(),
          sortOrder: items.length * 10,
          isActive: true,
          rentalAssetId:
            toCanonicalModule(moduleKey) === "rentals" && rentalAssetId
              ? rentalAssetId
              : null,
        },
        tenantId,
      )
      toast.success(t("admin.moduleMenu.createSuccess"))
      setLabel("")
      setRentalAssetId("")
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.moduleMenu.createError"),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await deleteModuleMenuItem(id, tenantId)
      toast.success(t("admin.moduleMenu.deleteSuccess"))
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.moduleMenu.deleteError"),
      )
    } finally {
      setSaving(false)
    }
  }

  const isRentals = toCanonicalModule(moduleKey) === "rentals"

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">
          {t("admin.moduleMenu.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("admin.moduleMenu.description")}
        </p>
      </div>

      {loading ? (
        <PageContentSkeleton rows={3} />
      ) : (
        <ul className="space-y-2">
          {items.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              {t("admin.moduleMenu.empty")}
            </li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.moduleName}
                    {item.isActive ? "" : ` · ${t("admin.moduleMenu.inactive")}`}
                    {item.rentalAssetId
                      ? ` · asset ${item.rentalAssetId.slice(0, 8)}…`
                      : ""}
                  </p>
                </div>
                <LoadingButton
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={saving}
                  onClick={() => {
                    void handleDelete(item.id)
                  }}
                >
                  {t("common.delete")}
                </LoadingButton>
              </li>
            ))
          )}
        </ul>
      )}

      <div className="space-y-2 rounded-md border border-dashed border-border p-3">
        <p className="text-sm font-medium">{t("admin.moduleMenu.add")}</p>
        <Input
          placeholder={t("admin.moduleMenu.labelPlaceholder")}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value)
          }}
        />
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={moduleKey}
          onChange={(event) => {
            setModuleKey(event.target.value)
            setRentalAssetId("")
          }}
        >
          {MODULE_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(`admin.modules.${key}`)}
            </option>
          ))}
        </select>
        {isRentals ? (
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={rentalAssetId}
            onChange={(event) => {
              setRentalAssetId(event.target.value)
            }}
          >
            <option value="">{t("admin.moduleMenu.anyAsset")}</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        ) : null}
        <LoadingButton
          type="button"
          loading={saving}
          disabled={label.trim().length === 0}
          onClick={() => {
            void handleCreate()
          }}
        >
          {t("admin.moduleMenu.create")}
        </LoadingButton>
      </div>
    </div>
  )
}
