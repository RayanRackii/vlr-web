import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
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
import { Textarea } from "@/components/ui/textarea"
import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  catalogProductFormSchema,
  formatCatalogMoney,
  type CatalogFileVisibility,
  type CatalogProduct,
  type CatalogProductFormValues,
  type ProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  activateCatalogProduct,
  createCatalogProduct,
  deactivateCatalogProduct,
  deleteCatalogProductFile,
  getCatalogProductFileUrl,
  listCatalogProducts,
  listProductRequests,
  updateCatalogProduct,
  uploadCatalogProductFile,
} from "@/features/catalog/services/catalogService"

function emptyProductForm(): CatalogProductFormValues {
  return {
    name: "",
    code: "",
    description: "",
    price: "",
    currency: "BRL",
  }
}

export function CatalogProductsPage() {
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()
  const canManage = can("catalog.products.manage")

  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [requests, setRequests] = useState<ProductRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogProduct | null>(null)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [fileBusy, setFileBusy] = useState(false)
  const [uploadVisibility, setUploadVisibility] =
    useState<CatalogFileVisibility>("CustomerVisible")

  const form = useForm<CatalogProductFormValues>({
    resolver: zodResolver(catalogProductFormSchema),
    defaultValues: emptyProductForm(),
  })

  async function reload() {
    setLoading(true)
    try {
      const [nextProducts, nextRequests] = await Promise.all([
        listCatalogProducts(),
        listProductRequests(),
      ])
      setProducts(nextProducts)
      setRequests(nextRequests)
      setLoadError(null)
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : t("apiErrors.loadCatalogProducts"),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, [])

  function openCreate() {
    setEditing(null)
    form.reset(emptyProductForm())
    setDialogOpen(true)
  }

  function openEdit(product: CatalogProduct) {
    setEditing(product)
    form.reset({
      name: product.name,
      code: product.code ?? "",
      description: product.description ?? "",
      price: product.price == null ? "" : String(product.price),
      currency: product.currency,
    })
    setDialogOpen(true)
  }

  async function onSubmit(values: CatalogProductFormValues) {
    const priceTrimmed = values.price.trim()
    let price: number | null = null
    if (priceTrimmed.length > 0) {
      const parsed = Number(priceTrimmed.replace(",", "."))
      if (!Number.isFinite(parsed) || parsed < 0) {
        form.setError("price", { message: t("catalog.products.invalidPrice") })
        return
      }
      price = parsed
    }

    const body = {
      name: values.name,
      code: values.code.trim().length > 0 ? values.code.trim() : null,
      description:
        values.description.trim().length > 0 ? values.description.trim() : null,
      price,
      currency: values.currency,
    }

    try {
      if (editing) {
        const updated = await updateCatalogProduct(editing.id, body)
        setEditing(updated)
        toast.success(t("catalog.products.toastUpdated"))
      } else {
        const created = await createCatalogProduct(body)
        setEditing(created)
        toast.success(t("catalog.products.toastCreated"))
      }
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.saveCatalogProduct"),
      )
    }
  }

  async function toggleActive(product: CatalogProduct) {
    setStatusBusyId(product.id)
    try {
      if (product.isActive) {
        await deactivateCatalogProduct(product.id)
        toast.success(t("catalog.products.toastDeactivated"))
      } else {
        await activateCatalogProduct(product.id)
        toast.success(t("catalog.products.toastActivated"))
      }
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.updateCatalogProductStatus"),
      )
    } finally {
      setStatusBusyId(null)
    }
  }

  async function onUploadFile(file: File | undefined) {
    if (!file || !editing) {
      return
    }
    setFileBusy(true)
    try {
      await uploadCatalogProductFile(editing.id, file, uploadVisibility)
      const refreshed = await listCatalogProducts()
      setProducts(refreshed)
      const next = refreshed.find((item) => item.id === editing.id) ?? null
      setEditing(next)
      toast.success(t("catalog.products.toastFileUploaded"))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.uploadCatalogFile"),
      )
    } finally {
      setFileBusy(false)
    }
  }

  async function onDeleteFile(fileId: string) {
    if (!editing) {
      return
    }
    setFileBusy(true)
    try {
      await deleteCatalogProductFile(editing.id, fileId)
      const refreshed = await listCatalogProducts()
      setProducts(refreshed)
      setEditing(refreshed.find((item) => item.id === editing.id) ?? null)
      toast.success(t("catalog.products.toastFileDeleted"))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.deleteCatalogFile"),
      )
    } finally {
      setFileBusy(false)
    }
  }

  async function onOpenFile(fileId: string) {
    if (!editing) {
      return
    }
    try {
      const result = await getCatalogProductFileUrl(editing.id, fileId)
      window.open(result.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.loadCatalogFileUrl"),
      )
    }
  }

  const columns = useMemo<ColumnDef<CatalogProduct>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.products.columns.name")}
          />
        ),
      },
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.products.columns.code")}
          />
        ),
        cell: ({ row }) => row.original.code ?? "—",
      },
      {
        id: "price",
        accessorFn: (row) =>
          formatCatalogMoney(row.price, row.currency, i18n.language) ??
          t("catalog.priceOnRequest"),
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.products.columns.price")}
          />
        ),
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.products.columns.status")}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "success" : "secondary"}>
            {row.original.isActive
              ? t("catalog.products.active")
              : t("catalog.products.inactive")}
          </Badge>
        ),
        filterFn: (row, _columnId, filterValue) => {
          if (typeof filterValue !== "string" || filterValue.trim() === "") {
            return true
          }
          const label = row.original.isActive
            ? t("catalog.products.active")
            : t("catalog.products.inactive")
          return label.toLowerCase().includes(filterValue.trim().toLowerCase())
        },
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: t("catalog.products.columns.actions"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Can permission="catalog.products.manage">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  openEdit(row.original)
                }}
              >
                {t("common.edit")}
              </Button>
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                loading={statusBusyId === row.original.id}
                onClick={() => {
                  void toggleActive(row.original)
                }}
              >
                {row.original.isActive
                  ? t("catalog.products.deactivate")
                  : t("catalog.products.activate")}
              </LoadingButton>
            </Can>
          </div>
        ),
      },
    ],
    [i18n.language, statusBusyId, t],
  )

  const table = useReactTable({
    data: products,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const requestColumns = useMemo<ColumnDef<ProductRequest>[]>(
    () => [
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.requests.columns.description")}
          />
        ),
      },
      {
        accessorKey: "quantity",
        header: t("catalog.requests.columns.quantity"),
        enableColumnFilter: false,
      },
      {
        accessorKey: "note",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.requests.columns.note")}
          />
        ),
        cell: ({ row }) => row.original.note ?? "—",
      },
      {
        accessorKey: "createdAt",
        header: t("catalog.requests.columns.createdAt"),
        enableColumnFilter: false,
        cell: ({ row }) =>
          new Intl.DateTimeFormat(i18n.language, {
            dateStyle: "short",
          }).format(new Date(row.original.createdAt)),
      },
    ],
    [i18n.language, t],
  )

  const [requestFilters, setRequestFilters] = useState<ColumnFiltersState>([])
  const requestTable = useReactTable({
    data: requests,
    columns: requestColumns,
    state: { columnFilters: requestFilters },
    onColumnFiltersChange: setRequestFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("catalog.products.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("catalog.products.subtitle")}
          </p>
        </div>
        <Can permission="catalog.products.manage">
          <Button type="button" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            {t("catalog.products.create")}
          </Button>
        </Can>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
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
            {loading ? (
              <TableRowsSkeleton columns={5} rows={4} />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {t("catalog.products.empty")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {t("catalog.requests.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("catalog.requests.subtitle")}
          </p>
        </div>
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              {requestTable.getHeaderGroups().map((headerGroup) => (
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
              {loading ? (
                <TableRowsSkeleton columns={4} rows={3} />
              ) : requestTable.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center">
                    {t("catalog.requests.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                requestTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditing(null)
            form.reset(emptyProductForm())
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("catalog.products.editTitle")
                : t("catalog.products.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("catalog.products.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("catalog.products.form.name")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("catalog.products.form.code")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("catalog.products.form.description")}
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("catalog.products.form.price")}</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder={t("catalog.priceOnRequest")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("catalog.products.form.currency")}
                      </FormLabel>
                      <FormControl>
                        <Input maxLength={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {canManage && editing ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">
                    {t("catalog.products.files.title")}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {(editing.files ?? []).map((file) => (
                      <li
                        key={file.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {file.fileName}{" "}
                          <Badge variant="outline">
                            {file.visibility === "CustomerVisible"
                              ? t("catalog.products.files.customerVisible")
                              : t("catalog.products.files.internal")}
                          </Badge>
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void onOpenFile(file.id)
                            }}
                          >
                            {t("catalog.products.files.open")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={fileBusy}
                            onClick={() => {
                              void onDeleteFile(file.id)
                            }}
                          >
                            {t("common.delete")}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      modal={false}
                      value={uploadVisibility}
                      onValueChange={(value) => {
                        if (
                          value === "CustomerVisible" ||
                          value === "InternalB2B"
                        ) {
                          setUploadVisibility(value)
                        }
                      }}
                      items={[
                        {
                          value: "CustomerVisible",
                          label: t("catalog.products.files.customerVisible"),
                        },
                        {
                          value: "InternalB2B",
                          label: t("catalog.products.files.internal"),
                        },
                      ]}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CustomerVisible">
                          {t("catalog.products.files.customerVisible")}
                        </SelectItem>
                        <SelectItem value="InternalB2B">
                          {t("catalog.products.files.internal")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="file"
                      disabled={fileBusy}
                      accept={
                        uploadVisibility === "CustomerVisible"
                          ? "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                          : ".pdf,.stl,.step,.stp,.dxf,application/pdf"
                      }
                      onChange={(event) => {
                        void onUploadFile(event.target.files?.[0])
                        event.target.value = ""
                      }}
                    />
                  </div>
                </div>
              ) : null}

              <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <LoadingButton
                  type="submit"
                  loading={form.formState.isSubmitting}
                  loadingLabel={t("catalog.products.saving")}
                >
                  {t("catalog.products.save")}
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
