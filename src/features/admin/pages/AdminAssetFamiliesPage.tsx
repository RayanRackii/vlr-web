import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  adminAssetFamilyToFormValues,
  createAdminAssetFamilyFormSchema,
  emptyAdminAssetFamilyFormValues,
  isSeedAssetFamilyKey,
  toCreateAdminAssetFamilyRequest,
  toUpdateAdminAssetFamilyRequest,
  type AdminAssetFamily,
  type AdminAssetFamilyFormValues,
  type AssetFamilyFieldType,
} from "@/features/admin/schemas/adminAssetFamilySchemas"
import {
  createAdminAssetFamily,
  deleteAdminAssetFamily,
  getAdminAssetFamily,
  listAdminAssetFamilies,
  updateAdminAssetFamily,
} from "@/features/admin/services/adminAssetFamiliesService"

const FIELD_TYPES: readonly AssetFamilyFieldType[] = ["text", "number", "boolean"]

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; family: AdminAssetFamily }

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

export function AdminAssetFamiliesPage() {
  const { t } = useTranslation()
  const [families, setFamilies] = useState<AdminAssetFamily[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [familyPendingDelete, setFamilyPendingDelete] =
    useState<AdminAssetFamily | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const loadRequestId = useRef(0)

  const formSchema = useMemo(
    () =>
      createAdminAssetFamilyFormSchema({
        keyInvalid: t("admin.assetFamilies.validation.key"),
        labelRequired: t("admin.assetFamilies.validation.labelRequired"),
        labelMax: t("admin.assetFamilies.validation.labelMax"),
        sortOrderInvalid: t("admin.assetFamilies.validation.sortOrder"),
        fieldKeyRequired: t("admin.assetFamilies.validation.fieldKey"),
        fieldKeyDuplicate: t("admin.assetFamilies.validation.fieldKeyDuplicate"),
        seedActive: t("admin.assetFamilies.validation.seedActive"),
      }),
    [t],
  )

  const form = useForm<AdminAssetFamilyFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyAdminAssetFamilyFormValues,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fields",
  })

  const watchedValues = useWatch({ control: form.control })
  const parsedForm = formSchema.safeParse(watchedValues)
  const isFormValid = parsedForm.success
  const watchedKey = typeof watchedValues.key === "string" ? watchedValues.key : ""
  const seedLocked = isSeedAssetFamilyKey(watchedKey.trim().toLowerCase())
  const issueMessages =
    !parsedForm.success && form.formState.isDirty
      ? [...new Set(parsedForm.error.issues.map((issue) => issue.message))]
      : []

  const fieldTypeItems = useMemo(
    () =>
      FIELD_TYPES.map((type) => ({
        value: type,
        label: t(`admin.assetFamilies.types.${type}`),
      })),
    [t],
  )

  const loadFamilies = useCallback(async () => {
    const requestId = loadRequestId.current + 1
    loadRequestId.current = requestId
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await listAdminAssetFamilies({ includeInactive })
      if (loadRequestId.current !== requestId) {
        return
      }

      setFamilies(data)
    } catch (error: unknown) {
      if (loadRequestId.current !== requestId) {
        return
      }

      console.error("AdminAssetFamiliesPage loadFamilies failed", error)
      setFamilies([])
      setLoadError(
        errorMessage(error, t("admin.assetFamilies.errors.loadFailed")),
      )
    } finally {
      if (loadRequestId.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [includeInactive, t])

  useEffect(() => {
    void loadFamilies()
  }, [loadFamilies])

  useEffect(() => {
    if (!seedLocked || watchedValues.isActive !== false) {
      return
    }

    form.setValue("isActive", true)
  }, [form, seedLocked, watchedValues.isActive])

  const openCreate = useCallback(() => {
    setFormError(null)
    form.reset(emptyAdminAssetFamilyFormValues)
    setEditor({ mode: "create" })
  }, [form])

  const openEdit = useCallback(
    async (family: AdminAssetFamily) => {
      setFormError(null)

      try {
        const detail = await getAdminAssetFamily(family.id)
        form.reset(adminAssetFamilyToFormValues(detail))
        setEditor({ mode: "edit", family: detail })
      } catch (error: unknown) {
        toast.error(t("admin.assetFamilies.errors.loadFailed"), {
          description: errorMessage(
            error,
            t("admin.assetFamilies.errors.loadFailed"),
          ),
        })
      }
    },
    [form, t],
  )

  const columns = useMemo<ColumnDef<AdminAssetFamily>[]>(
    () => [
      {
        accessorKey: "key",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("admin.assetFamilies.columns.key")}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.key}</span>
            {isSeedAssetFamilyKey(row.original.key) ? (
              <Badge variant="secondary">
                {t("admin.assetFamilies.seedBadge")}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "label",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("admin.assetFamilies.columns.label")}
          />
        ),
      },
      {
        id: "sortOrder",
        accessorFn: (row) => String(row.sortOrder),
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("admin.assetFamilies.columns.sortOrder")}
          />
        ),
      },
      {
        id: "fields",
        accessorFn: (row) => String(row.fields.length),
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("admin.assetFamilies.columns.fields")}
          />
        ),
      },
      {
        id: "status",
        accessorFn: (row) =>
          row.isActive
            ? t("admin.assetFamilies.statusActive")
            : t("admin.assetFamilies.statusInactive"),
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("admin.assetFamilies.columns.status")}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "success" : "secondary"}>
            {row.original.isActive
              ? t("admin.assetFamilies.statusActive")
              : t("admin.assetFamilies.statusInactive")}
          </Badge>
        ),
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: () => (
          <span className="sr-only">{t("admin.assetFamilies.columns.actions")}</span>
        ),
        cell: ({ row }) => {
          const family = row.original
          const seed = isSeedAssetFamilyKey(family.key)

          return (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void openEdit(family)
                }}
              >
                {t("admin.assetFamilies.actions.edit")}
              </Button>
              {seed ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t("admin.assetFamilies.actions.deleteNamed", {
                    label: family.label,
                  })}
                  onClick={() => {
                    setDeleteError(null)
                    setFamilyPendingDelete(family)
                  }}
                >
                  {t("admin.assetFamilies.actions.delete")}
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [openEdit, t],
  )

  const table = useReactTable({
    data: families,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  function closeEditor() {
    if (isSaving) {
      return
    }

    setEditor(null)
    setFormError(null)
    form.reset(emptyAdminAssetFamilyFormValues)
  }

  async function onSubmit(values: AdminAssetFamilyFormValues) {
    setIsSaving(true)
    setFormError(null)

    try {
      if (editor?.mode === "edit") {
        await updateAdminAssetFamily(
          editor.family.id,
          toUpdateAdminAssetFamilyRequest(values),
        )
        toast.success(t("admin.assetFamilies.success.updated"))
      } else {
        await createAdminAssetFamily(toCreateAdminAssetFamilyRequest(values))
        toast.success(t("admin.assetFamilies.success.created"))
      }

      setEditor(null)
      form.reset(emptyAdminAssetFamilyFormValues)
      await loadFamilies()
    } catch (error: unknown) {
      const message = errorMessage(
        error,
        t("admin.assetFamilies.errors.saveFailed"),
      )
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!familyPendingDelete) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteAdminAssetFamily(familyPendingDelete.id)
      toast.success(t("admin.assetFamilies.success.deleted"))
      setFamilyPendingDelete(null)
      await loadFamilies()
    } catch (error: unknown) {
      const message = errorMessage(
        error,
        t("admin.assetFamilies.errors.deleteFailed"),
      )
      setDeleteError(message)
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const editing = editor?.mode === "edit"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("admin.assetFamilies.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.assetFamilies.description")}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex items-center gap-2">
            <Switch
              id="admin-asset-families-include-inactive"
              checked={includeInactive}
              onCheckedChange={(checked) => {
                setIncludeInactive(checked)
              }}
            />
            <Label
              htmlFor="admin-asset-families-include-inactive"
              className="text-sm font-normal"
            >
              {t("admin.assetFamilies.includeInactive")}
            </Label>
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            {t("admin.assetFamilies.actions.create")}
          </Button>
        </div>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <p>{loadError}</p>
          <Button type="button" variant="outline" onClick={() => void loadFamilies()}>
            {t("admin.assetFamilies.actions.retry")}
          </Button>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
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
            {isLoading ? <TableRowsSkeleton columns={columns.length} /> : null}

            {!isLoading && table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="space-y-1 text-muted-foreground">
                    <p className="text-sm font-medium text-foreground">
                      {t("admin.assetFamilies.emptyTitle")}
                    </p>
                    <p className="text-xs">
                      {t("admin.assetFamilies.emptyDescription")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}

            {!isLoading
              ? table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-normal">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {isLoading ? (
          <div className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : null}

        {!isLoading && table.getRowModel().rows.length === 0 ? (
          <div className="space-y-1 rounded-xl border border-border p-4 text-center text-muted-foreground">
            <p className="text-sm font-medium text-foreground">
              {t("admin.assetFamilies.emptyTitle")}
            </p>
            <p className="text-xs">{t("admin.assetFamilies.emptyDescription")}</p>
          </div>
        ) : null}

        {!isLoading
          ? table.getRowModel().rows.map((row) => {
              const family = row.original
              const seed = isSeedAssetFamilyKey(family.key)

              return (
                <div
                  key={row.id}
                  className="space-y-2 rounded-xl border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{family.key}</p>
                        {seed ? (
                          <Badge variant="secondary">
                            {t("admin.assetFamilies.seedBadge")}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="break-words text-sm text-muted-foreground">
                        {family.label}
                      </p>
                    </div>
                    <Badge variant={family.isActive ? "success" : "secondary"}>
                      {family.isActive
                        ? t("admin.assetFamilies.statusActive")
                        : t("admin.assetFamilies.statusInactive")}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t("admin.assetFamilies.columns.sortOrder")}: {family.sortOrder}
                    </span>
                    <span>
                      {t("admin.assetFamilies.columns.fields")}: {family.fields.length}
                    </span>
                  </div>

                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      onClick={() => {
                        void openEdit(family)
                      }}
                    >
                      {t("admin.assetFamilies.actions.edit")}
                    </Button>
                    {seed ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        aria-label={t("admin.assetFamilies.actions.deleteNamed", {
                          label: family.label,
                        })}
                        onClick={() => {
                          setDeleteError(null)
                          setFamilyPendingDelete(family)
                        }}
                      >
                        {t("admin.assetFamilies.actions.delete")}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          : null}
      </div>

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor()
          }
        }}
      >
        <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("admin.assetFamilies.dialog.editTitle")
                : t("admin.assetFamilies.dialog.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? t("admin.assetFamilies.dialog.editDescription")
                : t("admin.assetFamilies.dialog.createDescription")}
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
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.assetFamilies.form.key")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        disabled={editing}
                        spellCheck={false}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(event) => {
                          field.onChange(event.target.value.toLowerCase())
                        }}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("admin.assetFamilies.form.keyHint")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.assetFamilies.form.label")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.assetFamilies.form.sortOrder")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step={1}
                        autoComplete="off"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) => {
                          const next = event.target.value
                          field.onChange(
                            next === "" ? Number.NaN : event.target.valueAsNumber,
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
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                      <FormLabel>{t("admin.assetFamilies.form.isActive")}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          disabled={seedLocked}
                          onCheckedChange={(checked) => {
                            field.onChange(checked)
                          }}
                        />
                      </FormControl>
                    </div>
                    {seedLocked ? (
                      <p className="text-xs text-muted-foreground">
                        {t("admin.assetFamilies.form.seedLocked")}
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-medium">
                    {t("admin.assetFamilies.form.fields")}
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      append({
                        key: "",
                        label: "",
                        type: "text",
                        required: false,
                      })
                    }}
                  >
                    {t("admin.assetFamilies.form.addField")}
                  </Button>
                </div>

                {fields.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.assetFamilies.form.fieldsEmpty")}
                  </p>
                ) : null}

                {fields.map((fieldRow, index) => (
                  <div
                    key={fieldRow.id}
                    className="space-y-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {t("admin.assetFamilies.form.fieldItem", {
                          number: index + 1,
                        })}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("admin.assetFamilies.form.removeField")}
                        onClick={() => {
                          remove(index)
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>

                    <FormField
                      control={form.control}
                      name={`fields.${index}.key`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("admin.assetFamilies.form.fieldKey")}
                          </FormLabel>
                          <FormControl>
                            <Input autoComplete="off" spellCheck={false} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`fields.${index}.label`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("admin.assetFamilies.form.fieldLabel")}
                          </FormLabel>
                          <FormControl>
                            <Input autoComplete="off" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`fields.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("admin.assetFamilies.form.fieldType")}
                          </FormLabel>
                          <Select
                            modal={false}
                            value={field.value}
                            items={fieldTypeItems}
                            onValueChange={(value) => {
                              if (
                                value === "text" ||
                                value === "number" ||
                                value === "boolean"
                              ) {
                                field.onChange(value)
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {fieldTypeItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
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
                      name={`fields.${index}.required`}
                      render={({ field }) => (
                        <FormItem>
                          <Label className="flex items-center gap-2 text-sm font-normal">
                            <Checkbox
                              checked={field.value}
                              onChange={(event) => {
                                field.onChange(event.target.checked)
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                            {t("admin.assetFamilies.form.fieldRequired")}
                          </Label>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>

              {issueMessages.length > 0 ? (
                <ul className="space-y-1 text-sm text-destructive" role="alert">
                  {issueMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}

              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={closeEditor}
                >
                  {t("common.cancel")}
                </Button>
                <FormPrimaryButton type="submit" isValid={isFormValid} loading={isSaving}>
                  {isSaving
                    ? t("admin.assetFamilies.actions.saving")
                    : t("admin.assetFamilies.actions.save")}
                </FormPrimaryButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={familyPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setFamilyPendingDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.assetFamilies.delete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {familyPendingDelete
                ? t("admin.assetFamilies.delete.description", {
                    label: familyPendingDelete.label,
                    key: familyPendingDelete.key,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} />
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void handleConfirmDelete()
              }}
            >
              {isDeleting
                ? t("admin.assetFamilies.delete.deleting")
                : t("admin.assetFamilies.delete.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
