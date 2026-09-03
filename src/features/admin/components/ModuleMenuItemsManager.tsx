import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ListPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PortalMenuPreview } from "@/features/admin/components/PortalMenuPreview"
import {
  isCustomerNavModule,
  suggestPortalMenuLabel,
  toCanonicalModuleName,
} from "@/features/catalog/customerNav"
import { iconForModule } from "@/features/tenantPortal/components/CustomerSidebar"
import type {
  ModuleMenuItem,
  TenantBranding,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  createModuleMenuItem,
  deleteModuleMenuItem,
  fetchPortalRentalAssets,
  fetchTenantBranding,
  listAdminModuleMenuItems,
  listTenantModuleMenuItems,
  updateModuleMenuItem,
} from "@/features/tenantPortal/services/tenantPortalService"
import { PeopleEmptyState } from "@/features/users/components/PeopleEmptyState"
import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { api } from "@/lib/api"

const CREATE_DRAFT_ID = "00000000-0000-4000-8000-000000000001"
const NEW_MODULE_OPTIONS = ["rentals", "catalog"] as const

const editorSchema = z.object({
  moduleName: z.string().trim().min(1),
  label: z.string().trim().min(1),
  isActive: z.boolean(),
  rentalAssetId: z.string(),
})

type EditorValues = z.infer<typeof editorSchema>

type DialogState = { mode: "create" } | { mode: "edit"; item: ModuleMenuItem }

type AssetOption = {
  id: string
  name: string
}

type ModuleMenuItemsManagerProps = {
  tenantId?: string
  subdomain?: string | null
  /** Canonical module keys. Super-Admin embed can pass the tenant's subscribed set. */
  activeModules?: readonly string[]
}

function asAssetOptions(list: unknown): AssetOption[] {
  if (!Array.isArray(list)) {
    return []
  }
  return list.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return []
    }
    const record = entry as Record<string, unknown>
    if (typeof record.id !== "string" || typeof record.name !== "string") {
      return []
    }
    return [{ id: record.id, name: record.name }]
  })
}

function sortMenuItems(items: readonly ModuleMenuItem[]): ModuleMenuItem[] {
  return items.slice().sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }
    return left.label.localeCompare(right.label, undefined, {
      sensitivity: "base",
    })
  })
}

function friendlyModuleLabel(
  moduleName: string,
  t: (key: string) => string,
): string {
  switch (toCanonicalModuleName(moduleName)) {
    case "rentals":
      return t("admin.modules.Rentals")
    case "catalog":
      return t("admin.modules.Catalog")
    case "inventory":
      return t("admin.modules.Inventory")
    case "pmoc":
      return t("admin.modules.PMOC")
    case "os":
      return t("admin.modules.OS")
    default:
      return t("admin.modules.unknown")
  }
}

function destinationLabel(
  item: ModuleMenuItem,
  assets: readonly AssetOption[],
  t: (key: string) => string,
): string | null {
  if (toCanonicalModuleName(item.moduleName) !== "rentals") {
    return null
  }
  if (!item.rentalAssetId) {
    return t("admin.moduleMenu.destinationGeneralAgenda")
  }
  return (
    assets.find((asset) => asset.id === item.rentalAssetId)?.name ??
    t("admin.moduleMenu.destinationUnknownAsset")
  )
}

function isModuleInTenant(
  moduleName: string,
  activeModules: readonly string[],
): boolean {
  const active = new Set(
    activeModules.map((name) => toCanonicalModuleName(name)),
  )
  return active.has(toCanonicalModuleName(moduleName))
}

export function ModuleMenuItemsManager({
  tenantId,
  subdomain,
  activeModules: activeModulesProp,
}: ModuleMenuItemsManagerProps) {
  const { t } = useTranslation()
  const { can, activeModules: permissionModules } = usePermissions()
  const canWrite = Boolean(tenantId) || can("core.module_menu.write")
  const activeModules = activeModulesProp ?? permissionModules

  const [items, setItems] = useState<ModuleMenuItem[]>([])
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ModuleMenuItem | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [labelTouched, setLabelTouched] = useState(false)
  const [editor, setEditor] = useState<EditorValues>({
    moduleName: "rentals",
    label: "",
    isActive: true,
    rentalAssetId: "",
  })
  const [activeNavId, setActiveNavId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop")

  const isFormValid = editorSchema.safeParse(editor).success
  const isRentals = toCanonicalModuleName(editor.moduleName) === "rentals"
  const sortedItems = useMemo(() => sortMenuItems(items), [items])

  const draftItem = useMemo((): ModuleMenuItem | null => {
    if (!dialog) {
      return null
    }
    const label = editor.label.trim()
    if (dialog.mode === "create" && label.length === 0) {
      return null
    }
    const rentalAssetId =
      isRentals && editor.rentalAssetId ? editor.rentalAssetId : null
    if (dialog.mode === "create") {
      return {
        id: CREATE_DRAFT_ID,
        moduleName: editor.moduleName,
        label,
        sortOrder: items.length * 10,
        isActive: editor.isActive,
        rentalAssetId,
      }
    }
    return {
      ...dialog.item,
      label: label.length > 0 ? label : dialog.item.label,
      isActive: editor.isActive,
      rentalAssetId,
    }
  }, [dialog, editor.isActive, editor.label, editor.moduleName, editor.rentalAssetId, isRentals, items.length])

  const previewItems = useMemo(() => {
    if (!draftItem) {
      return items
    }
    if (items.some((item) => item.id === draftItem.id)) {
      return items.map((item) =>
        item.id === draftItem.id ? { ...item, ...draftItem } : item,
      )
    }
    return [...items, draftItem]
  }, [draftItem, items])

  const previewSubdomain = subdomain?.trim() || "preview"

  async function loadAssets() {
    try {
      if (tenantId && subdomain) {
        const list = await fetchPortalRentalAssets(subdomain)
        setAssets(asAssetOptions(list))
        return
      }
      if (!tenantId) {
        const response = await api.get("/api/rental-assets")
        setAssets(asAssetOptions(response.data))
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

  useEffect(() => {
    const slug = subdomain?.trim()
    if (!slug) {
      setBranding(null)
      return
    }
    let cancelled = false
    void fetchTenantBranding(slug)
      .then((data) => {
        if (!cancelled) {
          setBranding(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranding(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [subdomain])

  function applySuggestedLabel(
    moduleName: string,
    rentalAssetId: string,
    touched: boolean,
  ) {
    if (touched) {
      return
    }
    const rentalAssetName =
      rentalAssetId.length > 0
        ? (assets.find((asset) => asset.id === rentalAssetId)?.name ?? null)
        : null
    setEditor((current) => ({
      ...current,
      label: suggestPortalMenuLabel({
        moduleName,
        rentalAssetName,
        t,
      }),
    }))
  }

  function openCreate() {
    setLabelTouched(false)
    const next: EditorValues = {
      moduleName: "rentals",
      label: suggestPortalMenuLabel({
        moduleName: "rentals",
        rentalAssetName: null,
        t,
      }),
      isActive: true,
      rentalAssetId: "",
    }
    setEditor(next)
    setDialog({ mode: "create" })
  }

  function openEdit(item: ModuleMenuItem) {
    setLabelTouched(true)
    setEditor({
      moduleName: toCanonicalModuleName(item.moduleName),
      label: item.label,
      isActive: item.isActive,
      rentalAssetId: item.rentalAssetId ?? "",
    })
    setDialog({ mode: "edit", item })
  }

  function closeDialog() {
    setDialog(null)
    setLabelTouched(false)
  }

  async function handleSave() {
    const parsed = editorSchema.safeParse(editor)
    if (!parsed.success || !dialog) {
      return
    }
    setSaving(true)
    const rentalAssetId =
      toCanonicalModuleName(parsed.data.moduleName) === "rentals" &&
      parsed.data.rentalAssetId
        ? parsed.data.rentalAssetId
        : null
    try {
      if (dialog.mode === "create") {
        await createModuleMenuItem(
          {
            moduleName: toCanonicalModuleName(parsed.data.moduleName),
            label: parsed.data.label.trim(),
            sortOrder: items.length * 10,
            isActive: parsed.data.isActive,
            rentalAssetId,
          },
          tenantId,
        )
        toast.success(t("admin.moduleMenu.createSuccess"))
      } else {
        await updateModuleMenuItem(
          dialog.item.id,
          {
            label: parsed.data.label.trim(),
            sortOrder: dialog.item.sortOrder,
            isActive: parsed.data.isActive,
            rentalAssetId,
          },
          tenantId,
        )
        toast.success(t("admin.moduleMenu.updateSuccess"))
      }
      closeDialog()
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : dialog.mode === "create"
            ? t("admin.moduleMenu.createError")
            : t("admin.moduleMenu.updateError"),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!pendingDelete) {
      return
    }
    setIsDeleting(true)
    try {
      await deleteModuleMenuItem(pendingDelete.id, tenantId)
      toast.success(t("admin.moduleMenu.deleteSuccess"))
      setPendingDelete(null)
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.moduleMenu.deleteError"),
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function moveItem(itemId: string, direction: -1 | 1) {
    const index = sortedItems.findIndex((item) => item.id === itemId)
    const swap = sortedItems[index + direction]
    const current = sortedItems[index]
    if (!current || !swap) {
      return
    }
    setSaving(true)
    try {
      await updateModuleMenuItem(
        current.id,
        {
          label: current.label,
          sortOrder: swap.sortOrder,
          isActive: current.isActive,
          rentalAssetId: current.rentalAssetId ?? null,
        },
        tenantId,
      )
      await updateModuleMenuItem(
        swap.id,
        {
          label: swap.label,
          sortOrder: current.sortOrder,
          isActive: swap.isActive,
          rentalAssetId: swap.rentalAssetId ?? null,
        },
        tenantId,
      )
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.moduleMenu.updateError"),
      )
    } finally {
      setSaving(false)
    }
  }

  const addButton = (
    <Button type="button" size="sm" onClick={openCreate}>
      {items.length === 0
        ? t("admin.moduleMenu.addFirst")
        : t("admin.moduleMenu.add")}
    </Button>
  )

  const writeControls = canWrite ? (
    tenantId ? (
      addButton
    ) : (
      <Can permission="core.module_menu.write">{addButton}</Can>
    )
  ) : null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">
              {t("admin.moduleMenu.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("admin.moduleMenu.description")}
            </p>
          </div>
          {items.length > 0 ? writeControls : null}
        </div>

        {loading ? (
          <PageContentSkeleton rows={3} />
        ) : items.length === 0 ? (
          <div className="space-y-4">
            <PeopleEmptyState
              icon={ListPlus}
              title={t("admin.moduleMenu.empty")}
              description={t("admin.moduleMenu.emptyDescription")}
            />
            {writeControls}
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedItems.map((item, index) => {
              const Icon = iconForModule(item.moduleName)
              const destination = destinationLabel(item, assets, t)
              const moduleActive = isModuleInTenant(
                item.moduleName,
                activeModules,
              )
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {item.label}
                        </p>
                        <Badge variant={item.isActive ? "success" : "outline"}>
                          {item.isActive
                            ? t("admin.moduleMenu.active")
                            : t("admin.moduleMenu.hidden")}
                        </Badge>
                        {moduleActive ? null : (
                          <Badge variant="warning">
                            {t("admin.moduleMenu.inactiveModule")}
                          </Badge>
                        )}
                        {isCustomerNavModule(item.moduleName) ? null : (
                          <Badge variant="secondary">
                            {t("admin.moduleMenu.notInPortal")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span>{friendlyModuleLabel(item.moduleName, t)}</span>
                        {destination ? (
                          <span>{` · ${destination}`}</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {canWrite ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={saving || index === 0}
                        aria-label={t("admin.moduleMenu.moveUp")}
                        onClick={() => {
                          void moveItem(item.id, -1)
                        }}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={saving || index === sortedItems.length - 1}
                        aria-label={t("admin.moduleMenu.moveDown")}
                        onClick={() => {
                          void moveItem(item.id, 1)
                        }}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          openEdit(item)
                        }}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPendingDelete(item)
                        }}
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant={viewport === "desktop" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setViewport("desktop")
            }}
          >
            {t("admin.moduleMenu.previewViewportDesktop")}
          </Button>
          <Button
            type="button"
            variant={viewport === "mobile" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setViewport("mobile")
            }}
          >
            {t("admin.moduleMenu.previewViewportMobile")}
          </Button>
        </div>
        <PortalMenuPreview
          branding={branding}
          items={previewItems}
          activeModules={activeModules}
          subdomain={previewSubdomain}
          activeNavId={activeNavId}
          onActiveNavIdChange={setActiveNavId}
          viewport={viewport}
        />
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit"
                ? t("admin.moduleMenu.editTitle")
                : t("admin.moduleMenu.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.moduleMenu.description")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSave()
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="module-menu-functionality">
                {t("admin.moduleMenu.functionality")}
              </Label>
              {dialog?.mode === "edit" &&
              !NEW_MODULE_OPTIONS.includes(
                toCanonicalModuleName(editor.moduleName) as
                  | "rentals"
                  | "catalog",
              ) ? (
                <p className="text-sm">{friendlyModuleLabel(editor.moduleName, t)}</p>
              ) : (
                <select
                  id="module-menu-functionality"
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                  value={editor.moduleName}
                  disabled={dialog?.mode === "edit"}
                  onChange={(event) => {
                    const moduleName = event.target.value
                    setEditor((current) => ({
                      ...current,
                      moduleName,
                      rentalAssetId: "",
                    }))
                    applySuggestedLabel(moduleName, "", labelTouched)
                  }}
                >
                  {NEW_MODULE_OPTIONS.map((key) => (
                    <option key={key} value={key}>
                      {key === "rentals"
                        ? t("admin.modules.Rentals")
                        : t("admin.modules.Catalog")}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {isRentals ? (
              <div className="grid gap-1.5">
                <Label htmlFor="module-menu-destination">
                  {t("admin.moduleMenu.destination")}
                </Label>
                <select
                  id="module-menu-destination"
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                  value={editor.rentalAssetId}
                  onChange={(event) => {
                    const rentalAssetId = event.target.value
                    setEditor((current) => ({
                      ...current,
                      rentalAssetId,
                    }))
                    applySuggestedLabel(
                      editor.moduleName,
                      rentalAssetId,
                      labelTouched,
                    )
                  }}
                >
                  <option value="">{t("admin.moduleMenu.anyAsset")}</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="module-menu-label">
                {t("admin.moduleMenu.label")}
              </Label>
              <Input
                id="module-menu-label"
                placeholder={t("admin.moduleMenu.labelPlaceholder")}
                value={editor.label}
                onChange={(event) => {
                  setLabelTouched(true)
                  setEditor((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="module-menu-active"
                checked={editor.isActive}
                onChange={(event) => {
                  setEditor((current) => ({
                    ...current,
                    isActive: event.currentTarget.checked,
                  }))
                }}
              />
              <Label htmlFor="module-menu-active" className="font-normal">
                {t("admin.moduleMenu.active")}
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={closeDialog}
              >
                {t("common.cancel")}
              </Button>
              <FormPrimaryButton
                type="submit"
                isValid={isFormValid}
                loading={saving}
              >
                {dialog?.mode === "edit"
                  ? t("admin.moduleMenu.save")
                  : t("admin.moduleMenu.create")}
              </FormPrimaryButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (isDeleting) {
            return
          }
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.moduleMenu.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.moduleMenu.deleteDescription", {
                label: pendingDelete?.label ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void handleDelete()
              }}
            >
              {t("common.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export type { ModuleMenuItemsManagerProps }
