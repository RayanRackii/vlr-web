import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { CircleCheck, Layers, LoaderCircle, MoreHorizontal } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
import { AssetDetailDialog } from "@/features/assets/components/AssetDetailDialog"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import {
  createBulkCreateAssetsFormSchema,
  type Asset,
  type AssetStatus,
  type BulkCreateAssetsFormValues,
} from "@/features/assets/schemas/assetSchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getCategories } from "@/features/assets/services/assetCategoriesService"
import {
  bulkCreateAssets,
  deleteAsset,
  getAssets,
} from "@/features/assets/services/assetsService"
import { getUnits } from "@/features/assets/services/unitsService"
import { isAxiosError } from "@/lib/api"

type AssetTableRow = Asset & {
  categoryName: string
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
  const { session } = useAuth()

  const [assets, setAssets] = useState<Asset[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [assetToDelete, setAssetToDelete] = useState<AssetTableRow | null>(null)
  const [deleteTagConfirm, setDeleteTagConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const formSchema = useMemo(
    () =>
      createBulkCreateAssetsFormSchema({
        unitRequired: t("assets.inventory.validation.unitRequired"),
        categoryRequired: t("assets.inventory.validation.categoryRequired"),
        baseLocationRequired: t(
          "assets.inventory.validation.baseLocationRequired",
        ),
        baseTagRequired: t("assets.inventory.validation.baseTagRequired"),
        startNumberRequired: t(
          "assets.inventory.validation.startNumberRequired",
        ),
        endNumberRequired: t("assets.inventory.validation.endNumberRequired"),
        rangeInvalid: t("assets.inventory.validation.rangeInvalid"),
      }),
    [t],
  )

  const form = useForm<BulkCreateAssetsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitId: "",
      categoryId: "",
      baseLocationName: "",
      baseTag: "",
      startNumber: 1,
      endNumber: 1,
    },
  })

  const loadPageData = useCallback(async () => {
    if (!session) {
      setLoadError(t("assets.inventory.errors.unauthorized"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const [assetsData, categoriesData, unitsData] = await Promise.all([
        getAssets(),
        getCategories(),
        getUnits(),
      ])

      setAssets(assetsData)
      setCategories(categoriesData)
      setUnits(unitsData)
    } catch (error: unknown) {
      console.error("AssetsPage loadPageData failed", error)
      if (isAxiosError(error)) {
        console.error("AssetsPage loadPageData response", error.response?.data)
      }

      const message =
        error instanceof Error
          ? error.message
          : t("assets.inventory.errors.loadFailed")
      setLoadError(message)
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

  const columns = useMemo<ColumnDef<AssetTableRow>[]>(
    () => [
      {
        accessorKey: "tag",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.inventory.columns.tag")}
          />
        ),
      },
      {
        accessorKey: "categoryName",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.inventory.columns.category")}
          />
        ),
      },
      {
        accessorKey: "location",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.inventory.columns.location")}
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
        cell: ({ row }) => {
          const status = row.original.status

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={getStatusBadgeVariant(status)}>
                {getStatusLabel(status, t)}
              </Badge>
              {row.original.isRentable ? (
                <Badge variant="outline">
                  {t("assets.inventory.flags.rentable")}
                </Badge>
              ) : null}
              {row.original.requiresMaintenance ? (
                <Badge variant="outline">
                  {t("assets.inventory.flags.maintenance")}
                </Badge>
              ) : null}
              {row.original.scheduledDeletionAt ? (
                <Badge variant="destructive">
                  {t("assets.deletion.pendingBadge")}
                </Badge>
              ) : null}
            </div>
          )
        },
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: () => null,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="icon" className="size-8" />
              }
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setDetailAssetId(row.original.id)
                  setIsDetailOpen(true)
                }}
              >
                {t("assets.actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  openDeleteDialog(row.original)
                }}
              >
                {t("assets.actions.remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [openDeleteDialog, t],
  )

  const table = useReactTable({
    data: tableRows,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredRows = table.getFilteredRowModel().rows
  const isHardDelete = assetToDelete?.scheduledDeletionAt != null
  const canConfirmDelete =
    assetToDelete !== null &&
    (isHardDelete || deleteTagConfirm === assetToDelete.tag)

  function handleDialogOpenChange(open: boolean) {
    setIsDialogOpen(open)

    if (!open) {
      form.reset({
        unitId: units[0]?.id ?? "",
        categoryId: "",
        baseLocationName: "",
        baseTag: "",
        startNumber: 1,
        endNumber: 1,
      })
      form.clearErrors()
    }
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open) {
      setAssetToDelete(null)
      setDeleteTagConfirm("")
      setDeleteError(null)
      setIsDeleting(false)
    }
  }

  function openBulkDialog() {
    form.reset({
      unitId: units[0]?.id ?? "",
      categoryId: "",
      baseLocationName: "",
      baseTag: "",
      startNumber: 1,
      endNumber: 1,
    })
    setIsDialogOpen(true)
  }

  async function onSubmit(values: BulkCreateAssetsFormValues) {
    if (!session) {
      form.setError("root", {
        message: t("assets.inventory.errors.unauthorized"),
      })
      return
    }

    try {
      const result = await bulkCreateAssets({
        unitId: values.unitId,
        categoryId: values.categoryId,
        baseLocationName: values.baseLocationName,
        baseTag: values.baseTag,
        startNumber: values.startNumber,
        endNumber: values.endNumber,
      })

      setIsDialogOpen(false)
      form.reset()
      setSuccessMessage(
        t("assets.inventory.success.bulkCreated", {
          count: result.createdCount,
        }),
      )
      await loadPageData()
    } catch (error: unknown) {
      console.error("AssetsPage onSubmit failed", error)
      if (isAxiosError(error)) {
        console.error("AssetsPage onSubmit response", error.response?.data)
      }

      const message =
        error instanceof Error
          ? error.message
          : t("assets.inventory.errors.bulkCreateFailed")

      form.setError("root", { message })
    }
  }

  async function handleDeleteConfirm() {
    if (!session || assetToDelete === null || !canConfirmDelete) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await deleteAsset(assetToDelete.id)
      handleDeleteDialogOpenChange(false)
      setSuccessMessage(
        result.permanentlyDeleted
          ? t("assets.deletion.permanentSuccess")
          : t("assets.deletion.scheduledSuccess"),
      )
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
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("assets.inventory.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("assets.inventory.description")}
          </p>
        </div>

        <Button type="button" onClick={openBulkDialog}>
          <Layers data-icon="inline-start" />
          {t("assets.inventory.actions.bulkAdd")}
        </Button>
      </div>

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

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    {t("assets.inventory.loading")}
                  </span>
                </TableCell>
              </TableRow>
            ) : null}

            {!isLoading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t("assets.inventory.empty")}
                </TableCell>
              </TableRow>
            ) : null}

            {!isLoading
              ? filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-normal">
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

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("assets.inventory.dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("assets.inventory.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void form.handleSubmit(onSubmit)(event)
              }}
            >
              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("assets.inventory.form.unit")}</FormLabel>
                    <Select
                      modal={false}
                      onValueChange={field.onChange}
                      value={field.value}
                      items={units.map((unit) => ({
                        value: unit.id.toString(),
                        label: unit.name,
                      }))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t(
                              "assets.inventory.form.unitPlaceholder",
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem
                            key={unit.id}
                            value={unit.id.toString()}
                          >
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("assets.inventory.form.category")}
                    </FormLabel>
                    <Select
                      modal={false}
                      onValueChange={field.onChange}
                      value={field.value}
                      items={categories.map((category) => ({
                        value: category.id.toString(),
                        label: category.name,
                      }))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t(
                              "assets.inventory.form.categoryPlaceholder",
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem
                            key={category.id}
                            value={category.id.toString()}
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="baseLocationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("assets.inventory.form.baseLocation")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder={t(
                          "assets.inventory.form.baseLocationPlaceholder",
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="baseTag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("assets.inventory.form.baseTag")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder={t(
                          "assets.inventory.form.baseTagPlaceholder",
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("assets.inventory.form.startNumber")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={Number.isFinite(field.value) ? field.value : ""}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          onChange={(event) => {
                            const nextValue = event.target.valueAsNumber
                            field.onChange(
                              Number.isNaN(nextValue) ? undefined : nextValue,
                            )
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("assets.inventory.form.endNumber")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={Number.isFinite(field.value) ? field.value : ""}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          onChange={(event) => {
                            const nextValue = event.target.valueAsNumber
                            field.onChange(
                              Number.isNaN(nextValue) ? undefined : nextValue,
                            )
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.formState.errors.root?.message ? (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              ) : null}

              <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 sm:justify-end sm:pr-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleDialogOpenChange(false)
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting
                    ? t("assets.inventory.actions.creating")
                    : t("assets.inventory.actions.create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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

      <AssetDetailDialog
        assetId={detailAssetId}
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open)
          if (!open) {
            setDetailAssetId(null)
          }
        }}
        units={units}
        categories={categories}
        onUpdated={() => {
          void loadPageData()
        }}
      />
    </div>
  )
}
