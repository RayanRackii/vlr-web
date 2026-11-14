import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CircleCheck, Layers, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { Page } from "@/components/layout/Page"
import { AssetWizard } from "@/features/assets/components/AssetWizard"
import { useAssetCopyTone } from "@/features/assets/hooks/useAssetCopyTone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useModuleIntroLink } from "@/hooks/useModuleIntroLink"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  describeApiError,
  isForbiddenError,
} from "@/features/users/permissions/rbacErrors"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import type {
  Asset,
  AssetStatus,
} from "@/features/assets/schemas/assetSchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import { getCategories } from "@/features/assets/services/assetCategoriesService"
import { listActiveAssetFamilies } from "@/features/assets/services/assetFamiliesService"
import {
  deleteAsset,
  getAssets,
} from "@/features/assets/services/assetsService"
import { getUnits } from "@/features/assets/services/unitsService"
import { isAxiosError } from "@/lib/api"

type AssetTableRow = Asset & {
  categoryName: string
}

type WizardMode = "create" | "bulk" | "edit"

type RowFilters = { search: string; category: string; location: string }

const ALL = "__all__"

function applyRowFilters(rows: AssetTableRow[], filters: RowFilters) {
  const needle = filters.search.trim().toLowerCase()

  return rows.filter(
    (row) =>
      (filters.category === ALL || row.categoryName === filters.category) &&
      (filters.location === ALL || row.location === filters.location) &&
      (needle === "" ||
        row.name.toLowerCase().includes(needle) ||
        row.tag.toLowerCase().includes(needle)),
  )
}

function getStatusBadgeVariant(
  status: AssetStatus,
): "success" | "secondary" | "warning" {
  switch (status) {
    case "Active":
      return "success"
    case "Inactive":
      return "secondary"
    case "Maintenance":
      return "warning"
  }
}

function getStatusLabel(
  status: AssetStatus,
  translate: (key: string) => string,
): string {
  switch (status) {
    case "Active":
      return translate("assets.inventory.status.Active")
    case "Inactive":
      return translate("assets.inventory.status.Inactive")
    case "Maintenance":
      return translate("assets.inventory.status.Maintenance")
  }
}

export function AssetsPage() {
  const { t } = useTranslation()
  const { tTone } = useAssetCopyTone()
  const { session } = useAuth()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const learnMore = useModuleIntroLink("maintenance")
  const { isTrialReadOnly } = useTrialStatus()
  const canWriteAssets = can("inventory.assets.write")
  const canWriteCategories = can("inventory.categories.write")

  const [assets, setAssets] = useState<Asset[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const [categoriesDenied, setCategoriesDenied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [assetsFailed, setAssetsFailed] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState(ALL)
  const [locationFilter, setLocationFilter] = useState(ALL)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )
  const [assetToDelete, setAssetToDelete] = useState<AssetTableRow | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTagConfirm, setDeleteTagConfirm] = useState("")
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const deleteInFlightRef = useRef(false)
  const [wizardMode, setWizardMode] = useState<WizardMode | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null)

  const loadPageData = useCallback(async () => {
    if (!session) {
      setAssetsFailed(true)
      setLoadError(t("assets.inventory.errors.unauthorized"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const [assetsResult, categoriesResult, unitsResult, familiesResult] =
        await Promise.allSettled([
          getAssets(),
          getCategories(),
          getUnits(),
          listActiveAssetFamilies(),
        ])

      let nextError: string | null = null

      setSelectedIds(new Set())

      if (assetsResult.status === "fulfilled") {
        setAssets(assetsResult.value)
        setAssetsFailed(false)
      } else {
        console.error("AssetsPage getAssets failed", assetsResult.reason)
        setAssets([])
        setAssetsFailed(true)
        nextError = describeApiError(
          assetsResult.reason,
          t("assets.inventory.errors.loadFailed"),
        )
      }

      if (categoriesResult.status === "fulfilled") {
        setCategories(categoriesResult.value)
        setCategoriesDenied(false)
      } else {
        console.error("AssetsPage getCategories failed", categoriesResult.reason)
        setCategories([])
        const denied = isForbiddenError(categoriesResult.reason)
        setCategoriesDenied(denied)
        if (!denied && nextError === null) {
          nextError = describeApiError(
            categoriesResult.reason,
            t("assets.categories.errors.loadFailed"),
          )
        }
      }

      if (unitsResult.status === "fulfilled") {
        setUnits(unitsResult.value)
      } else {
        console.error("AssetsPage getUnits failed", unitsResult.reason)
        setUnits([])
        if (!isForbiddenError(unitsResult.reason) && nextError === null) {
          nextError = describeApiError(
            unitsResult.reason,
            t("assets.inventory.errors.loadUnitsFailed"),
          )
        }
      }

      if (familiesResult.status === "fulfilled") {
        setFamilies(familiesResult.value)
      } else {
        console.error(
          "AssetsPage listActiveAssetFamilies failed",
          familiesResult.reason,
        )
        setFamilies([])
        if (!isForbiddenError(familiesResult.reason) && nextError === null) {
          nextError = describeApiError(
            familiesResult.reason,
            t("apiErrors.loadAssetFamilies"),
          )
        }
      }

      setLoadError(nextError)
    } catch (error: unknown) {
      console.error("AssetsPage loadPageData failed", error)
      if (isAxiosError(error)) {
        console.error("AssetsPage loadPageData response", error.response?.data)
      }

      setAssetsFailed(true)
      setLoadError(
        describeApiError(error, t("assets.inventory.errors.loadFailed")),
      )
    } finally {
      setIsLoading(false)
    }
  }, [session, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; loadPageData owns the loading and selection state
    void loadPageData()
  }, [loadPageData])

  useEffect(() => {
    if (successMessage === null) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null)
    }, 4000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [successMessage])

  const categoryNameById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]))
  }, [categories])

  const tableRows = useMemo<AssetTableRow[]>(
    () =>
      assets.map((asset) => ({
        ...asset,
        categoryName:
          categoryNameById.get(asset.categoryId) ??
          t("assets.inventory.emptyValue"),
      })),
    [assets, categoryNameById, t],
  )

  const openDeleteDialog = useCallback((asset: AssetTableRow) => {
    setAssetToDelete(asset)
    setDeleteTagConfirm("")
    setDeleteError(null)
  }, [])

  const openWizard = useCallback((mode: WizardMode, assetId?: string) => {
    setWizardMode(mode)
    setDetailAssetId(mode === "edit" ? (assetId ?? null) : null)
    setWizardOpen(true)
  }, [])

  const renderAssetName = useCallback(
    (asset: AssetTableRow) => (
      <Button
        type="button"
        variant="link"
        className="h-auto min-h-11 max-w-full whitespace-normal p-0 text-left [overflow-wrap:anywhere]"
        onClick={() => openWizard("edit", asset.id)}
      >
        {asset.name}
      </Button>
    ),
    [openWizard],
  )

  const renderStatusBadges = useCallback(
    (asset: AssetTableRow) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={getStatusBadgeVariant(asset.status)}>
          {getStatusLabel(asset.status, t)}
        </Badge>
        {asset.isRentable ? (
          <Badge variant="outline">{t("assets.inventory.flags.rentable")}</Badge>
        ) : null}
        {asset.requiresMaintenance ? (
          <Badge variant="outline">{t("assets.inventory.flags.maintenance")}</Badge>
        ) : null}
        {asset.scheduledDeletionAt ? (
          <Badge variant="destructive">{t("assets.deletion.pendingBadge")}</Badge>
        ) : null}
      </div>
    ),
    [t],
  )

  const renderRowActions = useCallback(
    (asset: AssetTableRow) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={t("assets.inventory.actions.rowMenu", {
                tag: asset.tag,
              })}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="min-h-11 py-2.5"
            disabled={isTrialReadOnly}
            onClick={() => {
              if (isTrialReadOnly) {
                return
              }
              openWizard("edit", asset.id)
            }}
          >
            {t("assets.actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 py-2.5"
            variant="destructive"
            disabled={isTrialReadOnly}
            onClick={() => {
              if (isTrialReadOnly) {
                return
              }
              openDeleteDialog(asset)
            }}
          >
            {t("assets.actions.remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    [isTrialReadOnly, openDeleteDialog, openWizard, t],
  )

  const categoryOptions = useMemo(
    () =>
      [...new Set(tableRows.map((row) => row.categoryName))].sort((x, y) =>
        x.localeCompare(y),
      ),
    [tableRows],
  )
  const locationOptions = useMemo(
    () =>
      [
        ...new Set(
          tableRows.flatMap((row) => (row.location ? [row.location] : [])),
        ),
      ].sort((x, y) => x.localeCompare(y)),
    [tableRows],
  )

  const filteredRows = useMemo(
    () =>
      applyRowFilters(tableRows, {
        search,
        category: categoryFilter,
        location: locationFilter,
      }),
    [tableRows, search, categoryFilter, locationFilter],
  )

  const hasActiveFilters =
    search.trim() !== "" || categoryFilter !== ALL || locationFilter !== ALL

  // Every filter change goes through here so the selection never keeps rows the user can no longer see.
  function applyFilters(change: Partial<RowFilters>) {
    const next: RowFilters = {
      search,
      category: categoryFilter,
      location: locationFilter,
      ...change,
    }
    const visibleIds = new Set(
      applyRowFilters(tableRows, next).map((row) => row.id),
    )

    setSearch(next.search)
    setCategoryFilter(next.category)
    setLocationFilter(next.location)
    setSelectedIds((current) => {
      const kept = [...current].filter((id) => visibleIds.has(id))
      return kept.length === current.size ? current : new Set(kept)
    })
  }

  function clearFilters() {
    applyFilters({ search: "", category: ALL, location: ALL })
  }

  const columns: DataListColumn<AssetTableRow>[] = [
    {
      id: "name",
      header: t("assets.detail.fields.name"),
      cell: renderAssetName,
    },
    {
      id: "tag",
      header: t("assets.inventory.columns.tag"),
      hideBelow: "lg",
      cell: (asset) => (
        <span className="[overflow-wrap:anywhere]">{asset.tag}</span>
      ),
    },
    {
      id: "category",
      header: t("assets.inventory.columns.category"),
      hideBelow: "lg",
      cell: (asset) => (
        <span className="[overflow-wrap:anywhere]">{asset.categoryName}</span>
      ),
    },
    {
      id: "location",
      header: t("assets.inventory.columns.location"),
      hideBelow: "lg",
      cell: (asset) => (
        <span className="[overflow-wrap:anywhere]">
          {asset.location ?? t("assets.inventory.emptyValue")}
        </span>
      ),
    },
    {
      id: "status",
      header: t("assets.inventory.columns.status"),
      cell: renderStatusBadges,
    },
    ...(canWriteAssets
      ? [
          {
            id: "actions",
            header: (
              <span className="sr-only">{t("assets.inventory.columns.actions")}</span>
            ),
            align: "end" as const,
            cell: renderRowActions,
          },
        ]
      : []),
  ]

  // Selected ids intersected with the visible rows: count and delete targets match what is on screen.
  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedIds.has(row.id)),
    [filteredRows, selectedIds],
  )
  const selectedCount = selectedRows.length
  const scheduleCount = selectedRows.filter(
    (asset) => asset.scheduledDeletionAt == null,
  ).length
  const permanentCount = selectedRows.filter(
    (asset) => asset.scheduledDeletionAt != null,
  ).length
  const isHardDelete = assetToDelete?.scheduledDeletionAt != null
  const canConfirmDelete =
    assetToDelete !== null &&
    (isHardDelete || deleteTagConfirm === assetToDelete.tag)
  const bulkConfirmPhrase = t("assets.deletion.bulkConfirmPhrase")
  const needsBulkConfirmPhrase = scheduleCount > 0
  const canConfirmBulkDelete =
    selectedCount > 0 &&
    (!needsBulkConfirmPhrase || bulkDeleteConfirm === bulkConfirmPhrase)
  const canOpenWizard =
    categories.length > 0 && families.length > 0 && !isTrialReadOnly

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open && deleteInFlightRef.current) {
      return
    }

    if (!open) {
      setAssetToDelete(null)
      setDeleteTagConfirm("")
      setDeleteError(null)
      setIsDeleting(false)
    }
  }

  function handleBulkDeleteOpenChange(open: boolean) {
    if (!open && deleteInFlightRef.current) {
      return
    }

    setBulkDeleteOpen(open)
    if (!open) {
      setBulkDeleteConfirm("")
      setDeleteError(null)
      setIsDeleting(false)
    }
  }

  function openBulkDeleteDialog() {
    if (selectedCount === 0 || isTrialReadOnly) {
      return
    }
    setBulkDeleteConfirm("")
    setDeleteError(null)
    setBulkDeleteOpen(true)
  }

  function handleWizardOpenChange(open: boolean) {
    setWizardOpen(open)
    if (!open) {
      setWizardMode(null)
      setDetailAssetId(null)
    }
  }

  async function handleDeleteConfirm() {
    if (!session || assetToDelete === null || !canConfirmDelete) {
      return
    }

    const assetId = assetToDelete.id
    deleteInFlightRef.current = true
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await deleteAsset(assetId)
      deleteInFlightRef.current = false
      handleDeleteDialogOpenChange(false)
      setBlockedMessage(null)
      const message = result.permanentlyDeleted
        ? t("assets.deletion.permanentSuccess")
        : t("assets.deletion.scheduledSuccess")
      setSuccessMessage(message)
      toast.success(message)
      await loadPageData()
    } catch (error: unknown) {
      console.error("AssetsPage handleDeleteConfirm failed", error)
      if (isAxiosError(error)) {
        console.error(
          "AssetsPage handleDeleteConfirm response",
          error.response?.data,
        )
      }

      const message =
        error instanceof Error
          ? error.message
          : t("assets.inventory.errors.deleteFailed")

      setDeleteError(message)
      setBlockedMessage(message)
      toast.error(message)
    } finally {
      deleteInFlightRef.current = false
      setIsDeleting(false)
    }
  }

  async function handleBulkDeleteConfirm() {
    if (!session || !canConfirmBulkDelete || selectedCount === 0) {
      return
    }

    deleteInFlightRef.current = true
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const results = await Promise.allSettled(
        selectedRows.map((asset) => deleteAsset(asset.id)),
      )

      let scheduled = 0
      let permanent = 0
      let failed = 0
      let firstFailure = ""

      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value.permanentlyDeleted) {
            permanent += 1
          } else {
            scheduled += 1
          }
        } else {
          failed += 1
          if (firstFailure === "" && result.reason instanceof Error) {
            firstFailure = result.reason.message
          }
        }
      }

      if (failed === results.length) {
        const message =
          firstFailure !== ""
            ? firstFailure
            : t("assets.inventory.errors.deleteFailed")
        setDeleteError(message)
        setBlockedMessage(message)
        toast.error(message)
        return
      }

      deleteInFlightRef.current = false
      handleBulkDeleteOpenChange(false)
      setSelectedIds(new Set())
      setBlockedMessage(null)

      const message =
        failed === 0
          ? t("assets.deletion.bulkSuccess", {
              scheduled,
              permanent,
              total: scheduled + permanent,
            })
          : t("assets.deletion.bulkPartialSuccess", {
              scheduled,
              permanent,
              failed,
            })
      setSuccessMessage(message)
      toast.success(message)

      await loadPageData()
    } catch (error: unknown) {
      console.error("AssetsPage handleBulkDeleteConfirm failed", error)
      const message =
        error instanceof Error
          ? error.message
          : t("assets.inventory.errors.deleteFailed")
      setDeleteError(message)
      setBlockedMessage(message)
      toast.error(message)
    } finally {
      deleteInFlightRef.current = false
      setIsDeleting(false)
    }
  }

  const filterOptionLabel = (value: string) =>
    value === ALL ? t("assets.inventory.filters.all") : value

  const filterSelect = (
    id: string,
    label: string,
    value: string,
    options: string[],
    onChange: (next: string) => void,
  ) => (
    <div className="flex min-w-0 flex-col gap-1 sm:w-48">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        modal={false}
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") {
            onChange(next)
          }
        }}
        items={[ALL, ...options].map((option) => ({
          value: option,
          label: filterOptionLabel(option),
        }))}
      >
        <SelectTrigger id={id} className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[ALL, ...options].map((option) => (
            <SelectItem key={option} value={option}>
              {filterOptionLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const filterChips = [
    ...(search.trim() !== ""
      ? [
          {
            label: `${t("assets.inventory.filters.searchLabel")}: ${search.trim()}`,
            onRemove: () => {
              applyFilters({ search: "" })
            },
          },
        ]
      : []),
    ...(categoryFilter !== ALL
      ? [
          {
            label: `${t("assets.inventory.filters.category")}: ${categoryFilter}`,
            onRemove: () => {
              applyFilters({ category: ALL })
            },
          },
        ]
      : []),
    ...(locationFilter !== ALL
      ? [
          {
            label: `${t("assets.inventory.filters.location")}: ${locationFilter}`,
            onRemove: () => {
              applyFilters({ location: ALL })
            },
          },
        ]
      : []),
  ]

  const emptyProps = hasActiveFilters
    ? {
        title: t("emptyStates.noResults"),
        description: t("emptyStates.filterDescription"),
        action: <Button onClick={clearFilters}>{t("emptyStates.clearFilters")}</Button>,
      }
    : {
        title:
          categories.length === 0 && !categoriesDenied
            ? tTone("assets.inventory.emptyNoTypes")
            : tTone("assets.inventory.empty"),
        example: canWriteAssets ? t("emptyStates.examples.assets") : undefined,
        learnMore,
        action:
          categories.length === 0 && !categoriesDenied && canWriteCategories ? (
            <Button onClick={() => { void navigate("/ativos/tipos") }}>{t("assets.inventory.emptyNoTypesCta")}</Button>
          ) : categories.length > 0 && canWriteAssets ? (
            <Button disabled={!canOpenWizard} onClick={() => { void navigate("/ativos/novo") }}>{t("assets.inventory.emptyWithTypesCta")}</Button>
          ) : undefined,
      }

  // A failed asset list becomes an error with retry; a failed lookup keeps the rows and shows the alert.
  const listFailed = loadError !== null && assetsFailed

  const headerActions = canWriteAssets ? (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={() => {
          void navigate("/ativos/novo")
        }}
        disabled={!canOpenWizard}
      >
        <Plus data-icon="inline-start" />
        {t("assets.inventory.actions.add")}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          openWizard("bulk")
        }}
        disabled={!canOpenWizard}
      >
        <Layers data-icon="inline-start" />
        {t("assets.inventory.actions.bulkAdd")}
      </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          openBulkDeleteDialog()
        }}
        disabled={selectedCount === 0 || isTrialReadOnly}
      >
        <Trash2 data-icon="inline-start" />
        {selectedCount > 0
          ? t("assets.inventory.actions.bulkDeleteCount", {
              count: selectedCount,
            })
          : t("assets.inventory.actions.bulkDelete")}
      </Button>
    </div>
  ) : undefined

  return (
    <Page
      header={{
        title: t("nav.assets"),
        description: tTone("assets.inventory.description"),
        actions: headerActions,
      }}
    >
      {isTrialReadOnly ? (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
          {t("trial.readOnlyHint")}
        </p>
      ) : null}

      {successMessage !== null ? (
        <div
          role="status"
          className="rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-green-900 dark:text-green-300"
        >
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      ) : null}

      {blockedMessage !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {blockedMessage}
        </div>
      ) : null}

      {loadError !== null && !listFailed ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      <DataList<AssetTableRow>
        {...(loadError !== null && listFailed
          ? {
              state: "error" as const,
              error: loadError,
              onRetry: () => {
                void loadPageData()
              },
            }
          : { state: isLoading ? ("loading" as const) : ("ready" as const) })}
        label={t("nav.assets")}
        columns={columns}
        rows={filteredRows}
        getRowId={(asset) => asset.id}
        toolbar={
          <FilterBar
            label={t("assets.inventory.filters.label")}
            search={{
              value: search,
              onChange: (value) => {
                applyFilters({ search: value })
              },
              placeholder: t("assets.inventory.filters.searchPlaceholder"),
              label: t("assets.inventory.filters.searchLabel"),
            }}
            filters={
              <>
                {filterSelect(
                  "assets-filter-category",
                  t("assets.inventory.filters.category"),
                  categoryFilter,
                  categoryOptions,
                  (value) => {
                    applyFilters({ category: value })
                  },
                )}
                {filterSelect(
                  "assets-filter-location",
                  t("assets.inventory.filters.location"),
                  locationFilter,
                  locationOptions,
                  (value) => {
                    applyFilters({ location: value })
                  },
                )}
              </>
            }
            chips={filterChips}
          />
        }
        heading={
          <p className="font-semibold text-foreground">
            {t("nav.assets")}: {filteredRows.length}
          </p>
        }
        empty={emptyProps}
        selection={
          canWriteAssets && !isTrialReadOnly
            ? {
                selectedIds,
                onChange: setSelectedIds,
                rowLabel: (asset) =>
                  t("assets.inventory.actions.selectRow", { tag: asset.tag }),
                selectAllLabel: t("assets.inventory.actions.selectAll"),
              }
            : undefined
        }
        renderCard={(asset) => (
          <>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                {renderAssetName(asset)}
                <p className="font-medium [overflow-wrap:anywhere]">{asset.tag}</p>
                <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {asset.categoryName}
                  {asset.location ? ` · ${asset.location}` : ""}
                </p>
              </div>
              {canWriteAssets ? renderRowActions(asset) : null}
            </div>
            {renderStatusBadges(asset)}
          </>
        )}
      />

      <Dialog
        open={assetToDelete !== null}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("assets.deletion.title")}</DialogTitle>
            <DialogDescription>
              {assetToDelete !== null && isHardDelete
                ? t("assets.deletion.assetPermanentWarning")
                : assetToDelete !== null
                  ? t("assets.deletion.assetScheduleWarning", {
                      tag: assetToDelete.tag,
                    })
                  : null}
            </DialogDescription>
          </DialogHeader>

          {assetToDelete !== null && !isHardDelete ? (
            <div className="space-y-2">
              <label
                htmlFor="delete-tag-confirm"
                className="text-sm font-medium"
              >
                {t("assets.inventory.columns.tag")}
              </label>
              <Input
                id="delete-tag-confirm"
                autoComplete="off"
                value={deleteTagConfirm}
                placeholder={t("assets.deletion.confirmNamePlaceholder")}
                onChange={(event) => {
                  setDeleteTagConfirm(event.target.value)
                }}
              />
            </div>
          ) : null}

          {deleteError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}

          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 sm:justify-end sm:pr-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleDeleteDialogOpenChange(false)
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canConfirmDelete || isDeleting}
              onClick={() => {
                void handleDeleteConfirm()
              }}
            >
              {isDeleting
                ? t("assets.deletion.deleting")
                : t("assets.deletion.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={handleBulkDeleteOpenChange}>
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("assets.deletion.bulkTitle")}</DialogTitle>
            <DialogDescription>
              {t("assets.deletion.bulkWarning", {
                count: selectedCount,
                scheduled: scheduleCount,
                permanent: permanentCount,
              })}
            </DialogDescription>
          </DialogHeader>

          {needsBulkConfirmPhrase ? (
            <div className="space-y-2">
              <label
                htmlFor="bulk-delete-confirm"
                className="text-sm font-medium"
              >
                {t("assets.deletion.bulkConfirmLabel", {
                  phrase: bulkConfirmPhrase,
                })}
              </label>
              <Input
                id="bulk-delete-confirm"
                autoComplete="off"
                value={bulkDeleteConfirm}
                placeholder={bulkConfirmPhrase}
                onChange={(event) => {
                  setBulkDeleteConfirm(event.target.value)
                }}
              />
            </div>
          ) : null}

          {deleteError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}

          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 sm:justify-end sm:pr-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleBulkDeleteOpenChange(false)
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canConfirmBulkDelete || isDeleting}
              onClick={() => {
                void handleBulkDeleteConfirm()
              }}
            >
              {isDeleting
                ? t("assets.deletion.deleting")
                : t("assets.deletion.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {wizardMode !== null ? (
        <AssetWizard
          mode={wizardMode}
          open={wizardOpen}
          onOpenChange={handleWizardOpenChange}
          units={units}
          categories={categories}
          families={families}
          assetId={detailAssetId}
          readOnly={isTrialReadOnly || !canWriteAssets}
          onCompleted={() => {
            void loadPageData()
          }}
        />
      ) : null}
    </Page>
  )
}
