import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { Page } from "@/components/layout/Page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import { AssetFamilyFieldEditor } from "@/features/admin/components/AssetFamilyFieldEditor"
import { AssetFamilyImpactSummary } from "@/features/admin/components/AssetFamilyImpactSummary"
import {
  adminAssetFamilyToFormValues,
  createAdminAssetFamilyFormSchema,
    emptyAdminAssetFamilyFormField,
  emptyAdminAssetFamilyFormValues,
  isSeedAssetFamilyKey,
  previewHasBlocking,
  previewNeedsConfirmation,
  toAdminAssetFamilySchemaPreviewRequest,
  toCreateAdminAssetFamilyRequest,
  toUpdateAdminAssetFamilyRequest,
  type AdminAssetFamily,
  type AdminAssetFamilyFormValues,
  type AdminAssetFamilySchemaPreview,
} from "@/features/admin/schemas/adminAssetFamilySchemas"
import {
  AdminAssetFamilyConflictError,
  createAdminAssetFamily,
  deleteAdminAssetFamily,
  getAdminAssetFamily,
  listAdminAssetFamilies,
  previewAdminAssetFamilySchema,
  updateAdminAssetFamily,
} from "@/features/admin/services/adminAssetFamiliesService"

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; family: AdminAssetFamily }

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

type StatusFilter = "all" | "active" | "inactive"

const STATUS_FILTERS: readonly StatusFilter[] = ["all", "active", "inactive"]

export function AdminAssetFamiliesPage() {
  const { t } = useTranslation()
  const [families, setFamilies] = useState<AdminAssetFamily[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [blockingPreview, setBlockingPreview] =
    useState<AdminAssetFamilySchemaPreview | null>(null)
  const [pendingSave, setPendingSave] = useState<{
    values: AdminAssetFamilyFormValues
    preview: AdminAssetFamilySchemaPreview
  } | null>(null)
  const [hasConflict, setHasConflict] = useState(false)
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
        fieldKeyPattern: t("admin.assetFamilies.validation.fieldKeyPattern"),
        seedActive: t("admin.assetFamilies.validation.seedActive"),
        fieldLabelMax: t("admin.assetFamilies.validation.fieldLabelMax"),
        helpMax: t("admin.assetFamilies.validation.helpMax"),
        groupMax: t("admin.assetFamilies.validation.groupMax"),
        unitMax: t("admin.assetFamilies.validation.unitMax"),
        numberInvalid: t("admin.assetFamilies.validation.numberInvalid"),
        minGreaterThanMax: t("admin.assetFamilies.validation.minGreaterThanMax"),
        decimalsInvalid: t("admin.assetFamilies.validation.decimalsInvalid"),
        maxLengthInvalid: t("admin.assetFamilies.validation.maxLengthInvalid"),
        optionsRequired: t("admin.assetFamilies.validation.optionsRequired"),
        optionsTooMany: t("admin.assetFamilies.validation.optionsTooMany"),
        optionInvalid: t("admin.assetFamilies.validation.optionInvalid"),
        optionDuplicate: t("admin.assetFamilies.validation.optionDuplicate"),
        tooManyActive: t("admin.assetFamilies.validation.tooManyActive"),
        tooManyTotal: t("admin.assetFamilies.validation.tooManyTotal"),
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial and includeInactive-driven fetch; loadFamilies sets loading state before the request
    void loadFamilies()
  }, [loadFamilies])

  useEffect(() => {
    if (!seedLocked || watchedValues.isActive !== false) {
      return
    }

    form.setValue("isActive", true)
  }, [form, seedLocked, watchedValues.isActive])

  const resetSaveState = useCallback(() => {
    setFormError(null)
    setHasConflict(false)
    setBlockingPreview(null)
    setPendingSave(null)
  }, [])

  const openCreate = useCallback(() => {
    resetSaveState()
    form.reset(emptyAdminAssetFamilyFormValues)
    setEditor({ mode: "create" })
  }, [form, resetSaveState])

  const openEdit = useCallback(
    async (family: AdminAssetFamily) => {
      resetSaveState()

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
    [form, resetSaveState, t],
  )

  const statusLabel = useCallback(
    (family: AdminAssetFamily) =>
      family.isActive
        ? t("admin.assetFamilies.statusActive")
        : t("admin.assetFamilies.statusInactive"),
    [t],
  )

  const visibleFamilies = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return families.filter(
      (family) =>
        (statusFilter === "all" ||
          family.isActive === (statusFilter === "active")) &&
        (needle === "" ||
          family.key.toLowerCase().includes(needle) ||
          family.label.toLowerCase().includes(needle)),
    )
  }, [families, search, statusFilter])

  const keyCell = (family: AdminAssetFamily) => (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="font-medium [overflow-wrap:anywhere]">{family.key}</span>
      {isSeedAssetFamilyKey(family.key) ? (
        <Badge variant="secondary">{t("admin.assetFamilies.seedBadge")}</Badge>
      ) : null}
    </div>
  )

  const statusBadge = (family: AdminAssetFamily) => (
    <Badge variant={family.isActive ? "success" : "secondary"}>
      {statusLabel(family)}
    </Badge>
  )

  const rowActions = (family: AdminAssetFamily, fullWidth = false) => {
    const seed = isSeedAssetFamilyKey(family.key)
    const buttonClass = fullWidth ? "min-h-11 flex-1" : undefined

    return (
      <div className={fullWidth ? "flex gap-2" : "flex justify-end gap-1"}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={buttonClass}
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
            className={buttonClass}
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
  }

  const columns: DataListColumn<AdminAssetFamily>[] = [
    {
      id: "key",
      header: t("admin.assetFamilies.columns.key"),
      cell: keyCell,
    },
    {
      id: "label",
      header: t("admin.assetFamilies.columns.label"),
      cell: (family) => (
        <span className="[overflow-wrap:anywhere]">{family.label}</span>
      ),
    },
    {
      id: "sortOrder",
      header: t("admin.assetFamilies.columns.sortOrder"),
      hideBelow: "lg",
      cell: (family) => String(family.sortOrder),
    },
    {
      id: "fields",
      header: t("admin.assetFamilies.columns.fields"),
      hideBelow: "lg",
      cell: (family) => String(family.fields.length),
    },
    {
      id: "status",
      header: t("admin.assetFamilies.columns.status"),
      cell: statusBadge,
    },
    {
      id: "actions",
      header: (
        <span className="sr-only">{t("admin.assetFamilies.columns.actions")}</span>
      ),
      align: "end",
      cell: (family) => rowActions(family),
    },
  ]

  const statusFilterLabel = (value: StatusFilter) =>
    value === "all"
      ? t("admin.assetFamilies.filters.all")
      : value === "active"
        ? t("admin.assetFamilies.statusActive")
        : t("admin.assetFamilies.statusInactive")

  const filterChips = [
    ...(search.trim() !== ""
      ? [
          {
            label: `${t("admin.assetFamilies.filters.searchLabel")}: ${search.trim()}`,
            onRemove: () => {
              setSearch("")
            },
          },
        ]
      : []),
    ...(statusFilter !== "all"
      ? [
          {
            label: `${t("admin.assetFamilies.filters.statusLabel")}: ${statusFilterLabel(statusFilter)}`,
            onRemove: () => {
              setStatusFilter("all")
            },
          },
        ]
      : []),
  ]

  function closeEditor() {
    if (isSaving) {
      return
    }

    setEditor(null)
    resetSaveState()
    form.reset(emptyAdminAssetFamilyFormValues)
  }

  function fieldLabelFor(key: string): string {
    const match = form
      .getValues("fields")
      .find((field) => field.key.trim() === key)
    const label = match?.label.trim() ?? ""

    return label !== "" ? label : key
  }

  async function persist(values: AdminAssetFamilyFormValues) {
    if (editor?.mode === "edit") {
      await updateAdminAssetFamily(
        editor.family.id,
        toUpdateAdminAssetFamilyRequest(values, editor.family.schemaVersion),
      )
      toast.success(t("admin.assetFamilies.success.updated"))
    } else {
      await createAdminAssetFamily(toCreateAdminAssetFamilyRequest(values))
      toast.success(t("admin.assetFamilies.success.created"))
    }

    setEditor(null)
    form.reset(emptyAdminAssetFamilyFormValues)
    await loadFamilies()
  }

  function reportSaveError(error: unknown) {
    const message = errorMessage(
      error,
      t("admin.assetFamilies.errors.saveFailed"),
    )
    setFormError(message)
    setHasConflict(error instanceof AdminAssetFamilyConflictError)
    toast.error(message)
  }

  async function onSubmit(values: AdminAssetFamilyFormValues) {
    setIsSaving(true)
    resetSaveState()

    try {
      if (editor?.mode === "edit") {
        const preview = await previewAdminAssetFamilySchema(
          editor.family.id,
          toAdminAssetFamilySchemaPreviewRequest(values),
        )

        if (previewHasBlocking(preview)) {
          setBlockingPreview(preview)
          return
        }

        if (previewNeedsConfirmation(preview)) {
          setPendingSave({ values, preview })
          return
        }
      }

      await persist(values)
    } catch (error: unknown) {
      reportSaveError(error)
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmPendingSave() {
    if (!pendingSave) {
      return
    }

    const { values } = pendingSave
    setPendingSave(null)
    setIsSaving(true)

    try {
      await persist(values)
    } catch (error: unknown) {
      reportSaveError(error)
    } finally {
      setIsSaving(false)
    }
  }

  async function reloadEditedFamily() {
    if (editor?.mode !== "edit") {
      return
    }

    try {
      const detail = await getAdminAssetFamily(editor.family.id)
      resetSaveState()
      form.reset(adminAssetFamilyToFormValues(detail))
      setEditor({ mode: "edit", family: detail })
    } catch (error: unknown) {
      setFormError(
        errorMessage(error, t("admin.assetFamilies.errors.loadFailed")),
      )
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
  const activeIndexes = fields.flatMap((_, index) =>
    watchedValues.fields?.[index]?.archived === true ? [] : [index],
  )
  const archivedIndexes = fields.flatMap((_, index) =>
    watchedValues.fields?.[index]?.archived === true ? [index] : [],
  )

  return (
    <Page
      header={{
        title: t("admin.assetFamilies.title"),
        description: t("admin.assetFamilies.description"),
        actions: (
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
        ),
      }}
    >
      <DataList<AdminAssetFamily>
        {...(loadError !== null
          ? {
              state: "error" as const,
              error: loadError,
              onRetry: () => {
                void loadFamilies()
              },
            }
          : { state: isLoading ? ("loading" as const) : ("ready" as const) })}
        label={t("admin.assetFamilies.title")}
        columns={columns}
        rows={visibleFamilies}
        getRowId={(family) => family.id}
        toolbar={
          <FilterBar
            label={t("admin.assetFamilies.filters.label")}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: t("admin.assetFamilies.filters.searchPlaceholder"),
              label: t("admin.assetFamilies.filters.searchLabel"),
            }}
            filters={
              <div
                role="group"
                aria-label={t("admin.assetFamilies.filters.statusLabel")}
                className="flex flex-row flex-wrap justify-start gap-1"
              >
                {STATUS_FILTERS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    className="min-h-11 rounded-full px-3"
                    variant={statusFilter === value ? "default" : "outline"}
                    aria-pressed={statusFilter === value}
                    onClick={() => {
                      setStatusFilter(value)
                    }}
                  >
                    {statusFilterLabel(value)}
                  </Button>
                ))}
              </div>
            }
            chips={filterChips}
          />
        }
        heading={
          <p className="font-semibold text-foreground">
            {t("admin.assetFamilies.title")}: {visibleFamilies.length}
          </p>
        }
        empty={{
          title: t("admin.assetFamilies.emptyTitle"),
          description: t("admin.assetFamilies.emptyDescription"),
        }}
        renderCard={(family) => (
          <>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                {keyCell(family)}
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {family.label}
                </p>
              </div>
              {statusBadge(family)}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("admin.assetFamilies.columns.sortOrder")}: {family.sortOrder}
              </span>
              <span>
                {t("admin.assetFamilies.columns.fields")}: {family.fields.length}
              </span>
            </div>
            {rowActions(family, true)}
          </>
        )}
      />

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor()
          }
        }}
      >
        <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-2xl">
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
                      append(emptyAdminAssetFamilyFormField())
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

                {activeIndexes.map((index, position) => (
                  <AssetFamilyFieldEditor
                    key={fields[index]?.id}
                    form={form}
                    index={index}
                    number={position + 1}
                    onRemove={() => {
                      remove(index)
                    }}
                  />
                ))}

                {archivedIndexes.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground">
                      {t("admin.assetFamilies.form.archivedFields", {
                        count: archivedIndexes.length,
                      })}
                    </h3>
                    {archivedIndexes.map((index) => (
                      <AssetFamilyFieldEditor
                        key={fields[index]?.id}
                        form={form}
                        index={index}
                        number={index + 1}
                        onRemove={() => {
                          remove(index)
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              {issueMessages.length > 0 ? (
                <ul className="space-y-1 text-sm text-destructive" role="alert">
                  {issueMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}

              {blockingPreview ? (
                <div className="space-y-2" role="alert">
                  <p className="text-sm font-medium text-destructive">
                    {t("admin.assetFamilies.impact.blockedTitle")}
                  </p>
                  <AssetFamilyImpactSummary
                    preview={blockingPreview}
                    labelFor={fieldLabelFor}
                    only="blocking"
                  />
                </div>
              ) : null}

              {formError ? (
                <div className="space-y-2" role="alert">
                  <p className="text-sm text-destructive">{formError}</p>
                  {hasConflict ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void reloadEditedFamily()
                      }}
                    >
                      {t("admin.assetFamilies.actions.reload")}
                    </Button>
                  ) : null}
                </div>
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
        open={pendingSave !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSave(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.assetFamilies.impact.confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.assetFamilies.impact.confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingSave ? (
            <AssetFamilyImpactSummary
              preview={pendingSave.preview}
              labelFor={fieldLabelFor}
              only="attention"
            />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel />
            <Button
              type="button"
              onClick={() => {
                void confirmPendingSave()
              }}
            >
              {t("admin.assetFamilies.impact.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </Page>
  )
}
