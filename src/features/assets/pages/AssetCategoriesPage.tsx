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
import { CircleCheck, LoaderCircle, MoreHorizontal, Plus } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
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
  DropdownMenuGroup,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { isAxiosError } from "@/lib/api"
import {
  createAssetCategoryFormSchema,
  type AssetCategory,
  type CreateAssetCategoryFormValues,
} from "@/features/assets/schemas/assetCategorySchemas"
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "@/features/assets/services/assetCategoriesService"

export function AssetCategoriesPage() {
  const { t } = useTranslation()
  const { session } = useAuth()

  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [categoryPendingDelete, setCategoryPendingDelete] =
    useState<AssetCategory | null>(null)
  const [confirmName, setConfirmName] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const formSchema = useMemo(
    () =>
      createAssetCategoryFormSchema({
        nameRequired: t("assets.categories.validation.nameRequired"),
        manufacturerRequired: t(
          "assets.categories.validation.manufacturerRequired",
        ),
      }),
    [t],
  )

  const form = useForm<CreateAssetCategoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      manufacturer: "",
      description: "",
    },
  })

  const loadCategories = useCallback(async () => {
    if (!session) {
      setLoadError(t("assets.categories.errors.unauthorized"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getCategories()
      setCategories(data)
    } catch (error: unknown) {
      console.error("AssetCategoriesPage loadCategories failed", error)
      if (isAxiosError(error)) {
        console.error(
          "AssetCategoriesPage loadCategories response",
          error.response?.data,
        )
      }

      const message =
        error instanceof Error
          ? error.message
          : t("assets.categories.errors.loadFailed")
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [session, t])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

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

  const openCreateDialog = useCallback(() => {
    setEditingId(null)
    form.reset({
      name: "",
      manufacturer: "",
      description: "",
    })
    form.clearErrors()
    setIsDialogOpen(true)
  }, [form])

  const openEditDialog = useCallback(
    (category: AssetCategory) => {
      setEditingId(category.id)
      form.reset({
        name: category.name,
        manufacturer: category.manufacturer ?? "",
        description: category.description ?? "",
      })
      form.clearErrors()
      setIsDialogOpen(true)
    },
    [form],
  )

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsDialogOpen(open)

      if (!open) {
        setEditingId(null)
        form.reset({
          name: "",
          manufacturer: "",
          description: "",
        })
        form.clearErrors()
      }
    },
    [form],
  )

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setCategoryPendingDelete(null)
      setConfirmName("")
      setIsDeleting(false)
    }
  }, [])

  const columns = useMemo<ColumnDef<AssetCategory>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.categories.columns.name")}
          />
        ),
      },
      {
        accessorKey: "manufacturer",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.categories.columns.manufacturer")}
          />
        ),
        cell: ({ getValue }) => {
          const value = getValue<string | null | undefined>()
          return value ?? t("assets.categories.emptyValue")
        },
      },
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("assets.categories.columns.description")}
          />
        ),
        cell: ({ getValue }) => {
          const value = getValue<string | null | undefined>()
          return value ?? t("assets.categories.emptyValue")
        },
      },
      {
        id: "status",
        header: t("assets.categories.columns.status"),
        cell: ({ row }) => {
          const category = row.original

          if (category.scheduledDeletionAt) {
            return (
              <Badge variant="destructive">
                {t("assets.deletion.pendingBadge")}
              </Badge>
            )
          }

          return (
            <Badge variant="secondary">
              {t("assets.categories.status.active")}
            </Badge>
          )
        },
      },
      {
        id: "actions",
        header: t("assets.categories.columns.actions"),
        enableColumnFilter: false,
        cell: ({ row }) => {
          const category = row.original

          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("assets.categories.actions.openMenu")}
                  />
                }
              >
                <MoreHorizontal aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => {
                      openEditDialog(category)
                    }}
                  >
                    {t("assets.categories.actions.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setCategoryPendingDelete(category)
                      setConfirmName("")
                    }}
                  >
                    {t("assets.categories.actions.remove")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [openEditDialog, t],
  )

  const table = useReactTable({
    data: categories,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const isHardDelete =
    categoryPendingDelete?.scheduledDeletionAt != null &&
    categoryPendingDelete.scheduledDeletionAt !== ""

  const isDeleteConfirmDisabled =
    isDeleting ||
    (!isHardDelete && confirmName !== categoryPendingDelete?.name)

  async function onSubmit(values: CreateAssetCategoryFormValues) {
    if (!session) {
      form.setError("root", {
        message: t("assets.categories.errors.unauthorized"),
      })
      return
    }

    try {
      if (editingId) {
        await updateCategory(editingId, {
          name: values.name,
          manufacturer: values.manufacturer,
          description: values.description,
        })
        setSuccessMessage(t("assets.categories.success.updated"))
      } else {
        await createCategory({
          name: values.name,
          manufacturer: values.manufacturer,
          description: values.description,
        })
        setSuccessMessage(t("assets.categories.success.created"))
      }

      setIsDialogOpen(false)
      setEditingId(null)
      form.reset({
        name: "",
        manufacturer: "",
        description: "",
      })
      await loadCategories()
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : editingId
            ? t("assets.categories.errors.updateFailed")
            : t("assets.categories.errors.createFailed")

      form.setError("root", { message })
    }
  }

  async function handleConfirmDelete() {
    if (!categoryPendingDelete || !session) {
      return
    }

    setIsDeleting(true)

    try {
      const result = await deleteCategory(categoryPendingDelete.id)

      setCategoryPendingDelete(null)
      setConfirmName("")
      setSuccessMessage(
        result.permanentlyDeleted
          ? t("assets.deletion.permanentSuccess")
          : t("assets.deletion.scheduledSuccess"),
      )
      await loadCategories()
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("assets.categories.errors.deleteFailed")

      setLoadError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("assets.categories.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("assets.categories.description")}
          </p>
        </div>

        <Button type="button" onClick={openCreateDialog}>
          <Plus data-icon="inline-start" />
          {t("assets.categories.actions.new")}
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
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" />
                      {t("assets.categories.loading")}
                    </span>
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {t("assets.categories.empty")}
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading
                ? table.getRowModel().rows.map((row) => (
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
            <DialogTitle>
              {editingId
                ? t("assets.categories.dialog.editTitle")
                : t("assets.categories.dialog.title")}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? t("assets.categories.dialog.editDescription")
                : t("assets.categories.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void form.handleSubmit(onSubmit)(event)
              }}
            >
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("assets.categories.form.name")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder={t(
                            "assets.categories.form.namePlaceholder",
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
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("assets.categories.form.manufacturer")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder={t(
                            "assets.categories.form.manufacturerPlaceholder",
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("assets.categories.form.description")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder={t(
                            "assets.categories.form.descriptionPlaceholder",
                          )}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.formState.errors.root?.message ? (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                ) : null}
              </div>

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
                    ? t("assets.categories.actions.saving")
                    : t("assets.categories.actions.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={categoryPendingDelete !== null}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("assets.deletion.title")}</DialogTitle>
            <DialogDescription>
              {isHardDelete
                ? t("assets.deletion.permanentWarning")
                : t("assets.deletion.scheduleWarning", {
                    name: categoryPendingDelete?.name ?? "",
                    count: categoryPendingDelete?.linkedAssetsCount ?? 0,
                  })}
            </DialogDescription>
          </DialogHeader>

          {!isHardDelete ? (
            <div className="space-y-2">
              <label
                htmlFor="confirm-category-name"
                className="text-sm font-medium"
              >
                {t("assets.deletion.confirmNameLabel")}
              </label>
              <Input
                id="confirm-category-name"
                autoComplete="off"
                placeholder={t("assets.deletion.confirmNamePlaceholder")}
                value={confirmName}
                onChange={(event) => {
                  setConfirmName(event.target.value)
                }}
              />
            </div>
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
              disabled={isDeleteConfirmDisabled}
              onClick={() => {
                void handleConfirmDelete()
              }}
            >
              {isDeleting
                ? t("assets.deletion.deleting")
                : t("assets.deletion.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
