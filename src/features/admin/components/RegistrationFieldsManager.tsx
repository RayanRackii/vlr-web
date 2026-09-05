import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ListPlus } from "lucide-react"
import { useForm } from "react-hook-form"
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
import { LoadingButton } from "@/components/ui/loading-button"
import { generateRegistrationFieldKey } from "@/features/admin/lib/generateRegistrationFieldKey"
import { registrationFieldTypeLabelKey } from "@/features/admin/lib/registrationFieldTypeLabel"
import {
  FIELD_TYPE_OPTIONS,
  isReservedRegisterFieldKey,
  type FieldTypeOption,
  type RegistrationField,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  createRegistrationField,
  deleteRegistrationField,
  listAdminRegistrationFields,
  listTenantRegistrationFields,
  updateRegistrationField,
} from "@/features/tenantPortal/services/tenantPortalService"
import { PeopleEmptyState } from "@/features/users/components/PeopleEmptyState"

const BUILT_IN_FIELDS = [
  { id: "name", labelKey: "tenantPortal.fields.name" },
  { id: "email", labelKey: "tenantPortal.fields.email" },
  { id: "password", labelKey: "tenantPortal.fields.password" },
  { id: "confirmPassword", labelKey: "tenantPortal.fields.confirmPassword" },
  { id: "phone", labelKey: "tenantPortal.fields.phone" },
  { id: "customerType", labelKey: "tenantPortal.fields.customerType" },
  { id: "document", labelKey: "admin.registrationFields.builtIn.document" },
] as const

const editorSchema = z.object({
  label: z.string().trim().min(1),
  fieldType: z.enum(FIELD_TYPE_OPTIONS),
  isRequired: z.boolean(),
  optionsCsv: z.string(),
})

type EditorFormValues = z.infer<typeof editorSchema>

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; field: RegistrationField }

type RegistrationFieldsManagerProps = {
  /** When set, uses platform-admin endpoints for that tenant. */
  tenantId?: string
  /** Caller-owned write gate. Super-Admin embed passes true; tenant pages pass the real permission. */
  canWrite: boolean
}

function parseOptions(
  fieldType: string,
  optionsCsv: string,
): string[] | null {
  if (fieldType !== "select") {
    return null
  }

  const options = optionsCsv
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  return options.length > 0 ? options : null
}

export function RegistrationFieldsManager({
  tenantId,
  canWrite,
}: RegistrationFieldsManagerProps) {
  const { t } = useTranslation()

  const [fields, setFields] = useState<RegistrationField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [fieldPendingDelete, setFieldPendingDelete] =
    useState<RegistrationField | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const customFields = useMemo(
    () => fields.filter((field) => !isReservedRegisterFieldKey(field.fieldKey)),
    [fields],
  )

  const form = useForm<EditorFormValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      label: "",
      fieldType: "text",
      isRequired: false,
      optionsCsv: "",
    },
  })

  const watchedValues = form.watch()
  const isFormValid = editorSchema.safeParse(watchedValues).success
  const derivedKey = generateRegistrationFieldKey(
    watchedValues.label,
    customFields.map((field) => field.fieldKey),
  )

  async function reload() {
    setLoading(true)
    try {
      const data = tenantId
        ? await listAdminRegistrationFields(tenantId)
        : await listTenantRegistrationFields()
      setFields(data)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.registrationFields.loadError"),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  function openCreate() {
    setDialog({ mode: "create" })
    form.reset({
      label: "",
      fieldType: "text",
      isRequired: false,
      optionsCsv: "",
    })
    form.clearErrors()
  }

  function openEdit(field: RegistrationField) {
    setDialog({ mode: "edit", field })
    form.reset({
      label: field.label,
      fieldType: (FIELD_TYPE_OPTIONS as readonly string[]).includes(
        field.fieldType,
      )
        ? (field.fieldType as FieldTypeOption)
        : "text",
      isRequired: field.isRequired,
      optionsCsv: field.options?.join(", ") ?? "",
    })
    form.clearErrors()
  }

  function closeDialog() {
    if (saving) {
      return
    }
    setDialog(null)
  }

  async function handleSave(values: EditorFormValues) {
    setSaving(true)
    try {
      const options = parseOptions(values.fieldType, values.optionsCsv)

      if (dialog?.mode === "edit") {
        await updateRegistrationField(
          dialog.field.id,
          {
            label: values.label.trim(),
            fieldType: values.fieldType,
            isRequired: values.isRequired,
            sortOrder: dialog.field.sortOrder,
            options,
          },
          tenantId,
        )
        toast.success(t("admin.registrationFields.updateSuccess"))
      } else {
        await createRegistrationField(
          {
            fieldKey: generateRegistrationFieldKey(
              values.label,
              customFields.map((field) => field.fieldKey),
            ),
            label: values.label.trim(),
            fieldType: values.fieldType,
            isRequired: values.isRequired,
            sortOrder: customFields.length,
            options,
          },
          tenantId,
        )
        toast.success(t("admin.registrationFields.createSuccess"))
      }

      setDialog(null)
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : dialog?.mode === "edit"
            ? t("admin.registrationFields.updateError")
            : t("admin.registrationFields.createError"),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!fieldPendingDelete) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteRegistrationField(fieldPendingDelete.id, tenantId)
      toast.success(t("admin.registrationFields.deleteSuccess"))
      setFieldPendingDelete(null)
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.registrationFields.deleteError"),
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const addButton = (
    <Button type="button" size="sm" onClick={openCreate}>
      {t("admin.registrationFields.add")}
    </Button>
  )

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            {t("admin.registrationFields.builtIn.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.registrationFields.builtIn.description")}
          </p>
        </div>
        <ul className="space-y-2">
          {BUILT_IN_FIELDS.map((field) => (
            <li
              key={field.id}
              className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm font-medium">{t(field.labelKey)}</p>
              <Badge variant="secondary">
                {t("admin.registrationFields.required")}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">
              {t("admin.registrationFields.custom.title")}
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              {t("admin.registrationFields.custom.description")}
            </p>
          </div>
          {canWrite ? addButton : null}
        </div>

        {loading ? (
          <PageContentSkeleton rows={3} />
        ) : customFields.length === 0 ? (
          <PeopleEmptyState
            icon={ListPlus}
            title={t("admin.registrationFields.empty")}
            description={t("admin.registrationFields.emptyDescription")}
          />
        ) : (
          <ul className="space-y-2">
            {customFields.map((field) => (
              <li
                key={field.id}
                className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{field.label}</p>
                    <Badge variant={field.isRequired ? "secondary" : "outline"}>
                      {field.isRequired
                        ? t("admin.registrationFields.required")
                        : t("admin.registrationFields.optional")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(registrationFieldTypeLabelKey(field.fieldType))}
                  </p>
                </div>
                {canWrite ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        openEdit(field)
                      }}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFieldPendingDelete(field)
                      }}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

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
                ? t("admin.registrationFields.editTitle")
                : t("admin.registrationFields.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit"
                ? t("admin.registrationFields.custom.description")
                : t("admin.registrationFields.emptyDescription")}
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(event) => {
              void form.handleSubmit(handleSave)(event)
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="registration-field-label">
                {t("admin.registrationFields.label")}
              </Label>
              <Input
                id="registration-field-label"
                {...form.register("label")}
              />
              {dialog?.mode === "create" && watchedValues.label.trim() ? (
                <p className="text-xs text-muted-foreground">
                  {t("admin.registrationFields.generatedKey", {
                    key: derivedKey,
                  })}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="registration-field-type">
                {t("admin.registrationFields.fieldType")}
              </Label>
              <select
                id="registration-field-type"
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                {...form.register("fieldType")}
              >
                {FIELD_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {t(registrationFieldTypeLabelKey(type))}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="registration-field-required"
                {...form.register("isRequired")}
              />
              <Label
                htmlFor="registration-field-required"
                className="font-normal"
              >
                {t("admin.registrationFields.requiredCheckbox")}
              </Label>
            </div>

            {watchedValues.fieldType === "select" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="registration-field-options">
                  {t("admin.registrationFields.optionsPlaceholder")}
                </Label>
                <Input
                  id="registration-field-options"
                  placeholder={t("admin.registrationFields.optionsPlaceholder")}
                  {...form.register("optionsCsv")}
                />
              </div>
            ) : null}

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
                {t("admin.registrationFields.save")}
              </FormPrimaryButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={fieldPendingDelete !== null}
        onOpenChange={(open) => {
          if (isDeleting) {
            return
          }
          if (!open) {
            setFieldPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.registrationFields.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.registrationFields.deleteDescription", {
                label: fieldPendingDelete?.label ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} />
            <LoadingButton
              type="button"
              variant="destructive"
              loading={isDeleting}
              onClick={() => {
                void handleDelete()
              }}
            >
              {t("common.delete")}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
