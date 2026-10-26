import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
} from "@tanstack/react-table"
import { CircleCheck, Layers, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
import { AssetWizard } from "@/features/assets/components/AssetWizard"
import { useAssetCopyTone } from "@/features/assets/hooks/useAssetCopyTone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
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

      if (assetsResult.status === "fulfilled") {
        setAssets(assetsResult.value)
      } else {
        console.error("AssetsPage getAssets failed", assetsResult.reason)
        setAssets([])
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

      setLoadError(
        describeApiError(error, t("assets.inventory.errors.loadFailed")),
      )
    } finally {
      setIsLoading(false)
    }
  }, [session, t])

  useEffect(() => {
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

  const renderStatusBadges = useCallback(
    (asset: AssetTableRow) => (
      <div className="flex flex-wrap items-center justify-center gap-1.5">
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

  const columns = useMemo<ColumnDef<AssetTableRow>[]>(
    () => [
      {
        id: "select",
        enableColumnFilter: false,
        enableSorting: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            className="size-4 accent-primary"
            aria-label={t("assets.inventory.actions.selectAll")}
            checked={table.getIsAllPageRowsSelected()}
            ref={(element) => {
              if (element) {
                element.indeterminate =
                  table.getIsSomePageRowsSelected() &&
                  !table.getIsAllPageRowsSelected()
              }
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            disabled={isTrialReadOnly}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="size-4 accent-primary"
            aria-label={t("assets.inventory.actions.selectRow", {
              tag: row.original.tag,
            })}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            disabled={isTrialReadOnly}
          />
        ),
      },
      {
        accessorKey: "tag",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.inventory.columns.tag")}
            className="flex items-center justify-center gap-2"
          />
        ),
      },
      {
        accessorKey: "categoryName",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.inventory.columns.category")}
            className="flex items-center justify-center gap-2"
          />
        ),
      },
      {
        accessorKey: "location",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.inventory.columns.location")}
            className="flex items-center justify-center gap-2"
          />
        ),
        cell: ({ getValue }) => {
          const value = getValue<string | null>()
          return value ?? t("assets.inventory.emptyValue")
        },
      },
      {
        accessorKey: "status",
        header: t("assets.inventory.columns.status"),
        cell: ({ row }) => renderStatusBadges(row.original),
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: () => null,
        cell: ({ row }) => renderRowActions(row.original),
      },
    ],
    [isTrialReadOnly, renderRowActions, renderStatusBadges, t],
  )

  const tableColumns = useMemo(
    () =>
      canWriteAssets
        ? columns
        : columns.filter(
            (column) => column.id !== "select" && column.id !== "actions",
          ),
    [canWriteAssets, columns],
  )

  const table = useReactTable({
    data: tableRows,
    columns: tableColumns,
    state: {
      columnFilters,
      rowSelection,
    },
    getRowId: (row) => row.id,
    enableRowSelection: canWriteAssets && !isTrialReadOnly,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredRows = table.getFilteredRowModel().rows
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original)
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
      setRowSelection({})
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tTone("assets.inventory.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tTone("assets.inventory.description")}
          </p>
        </div>

        {canWriteAssets ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                openWizard("create")
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
        ) : null}
      </div>

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

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-center">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRowsSkeleton columns={tableColumns.length} />
            ) : null}

            {!isLoading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {categories.length === 0 && !categoriesDenied
                        ? tTone("assets.inventory.emptyNoTypes")
                        : tTone("assets.inventory.empty")}
                    </p>
                    {categories.length === 0 &&
                    !categoriesDenied &&
                    canWriteCategories ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void navigate("/ativos/categorias")
                        }}
                      >
                        {t("assets.inventory.emptyNoTypesCta")}
                      </Button>
                    ) : null}
                    {categories.length > 0 && canWriteAssets ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          openWizard("create")
                        }}
                      >
                        {t("assets.inventory.emptyWithTypesCta")}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}

            {!isLoading
              ? filteredRows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="whitespace-normal text-center"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 sm:hidden">
        {isLoading ? (
          <div className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : null}

        {!isLoading && filteredRows.length === 0 ? (
          <div className="rounded-xl border border-border p-4">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-2 text-center">
              <p className="text-sm text-muted-foreground">
                {categories.length === 0 && !categoriesDenied
                  ? tTone("assets.inventory.emptyNoTypes")
                  : tTone("assets.inventory.empty")}
              </p>
              {categories.length === 0 && !categoriesDenied && canWriteCategories ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void navigate("/ativos/categorias")
                  }}
                >
                  {t("assets.inventory.emptyNoTypesCta")}
                </Button>
              ) : null}
              {categories.length > 0 && canWriteAssets ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    openWizard("create")
                  }}
                >
                  {t("assets.inventory.emptyWithTypesCta")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isLoading
          ? filteredRows.map((row) => {
              const asset = row.original
              return (
                <div
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="rounded-xl border border-border p-3 data-[state=selected]:border-primary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      {canWriteAssets ? (
                        <label className="-m-3 flex size-11 shrink-0 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            className="size-5 accent-primary"
                            aria-label={t("assets.inventory.actions.selectRow", {
                              tag: asset.tag,
                            })}
                            checked={row.getIsSelected()}
                            onChange={row.getToggleSelectedHandler()}
                            disabled={isTrialReadOnly}
                          />
                        </label>
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{asset.tag}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {asset.categoryName}
                          {asset.location ? ` · ${asset.location}` : ""}
                        </p>
                      </div>
                    </div>
                    {canWriteAssets ? renderRowActions(asset) : null}
                  </div>
                  <div className="mt-2">{renderStatusBadges(asset)}</div>
                </div>
              )
            })
          : null}
      </div>

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
          readOnly={isTrialReadOnly}
          onCompleted={() => {
            void loadPageData()
          }}
        />
      ) : null}
    </div>
  )
}
