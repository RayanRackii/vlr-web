import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarDays, ChevronRight, ClipboardList, Hash, Image, List, ListPlus, LockKeyhole, Mail, MapPin, Phone, ToggleRight, Type, type LucideIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import "@/features/users/people-access.css"
import { PeopleEmptyState } from "@/features/users/components/PeopleEmptyState"
import { PeopleMobileActionSheet } from "@/features/users/components/PeopleMobileActionSheet"
import { usePeopleMobileActions } from "@/features/users/hooks/usePeopleMobileActions"

const FIELD_ICONS: Readonly<Record<string, LucideIcon>> = {
  date: CalendarDays, select: List, boolean: ToggleRight, photo: Image,
  cep: MapPin, email: Mail, phone: Phone, number: Hash, text: Type,
  cpf: ClipboardList, cnpj: ClipboardList,
}

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
  const { isMobile, actionItem: actionField, setActionItem: setActionField, actionTriggerRef } = usePeopleMobileActions<RegistrationField>()

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
    actionTriggerRef.current = null
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
      setActionField(null)
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
      <ListPlus aria-hidden strokeWidth={1.75} />
      {t("admin.registrationFields.createTitle")}
    </Button>
  )

  return (
    <div className="people-fields-grid">
      <section className="people-field-section people-built-in space-y-4">
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
              className="people-built-in-row"
            >
              <LockKeyhole aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 text-sm font-medium">{t(field.labelKey)}</p>
              <Badge variant="secondary">
                {t("admin.registrationFields.required")}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="people-field-section space-y-4">
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
          <>
          {canWrite ? <p className="people-actions-hint"><ChevronRight aria-hidden strokeWidth={1.75} />{t("peopleAccess.mobileActions.hint")}</p> : null}
          <ul className="people-custom-fields">
            {customFields.map((field) => {
              const Icon = FIELD_ICONS[field.fieldType] ?? Type
              return (
                <li key={field.id} className="people-field-row">
                  <span className="people-field-icon"><Icon aria-hidden strokeWidth={1.75} /></span>
                  <div className="people-field-name">
                    <p className="text-sm font-semibold break-words">{field.label}</p>
                    <p className="text-xs font-mono text-muted-foreground break-all">{field.fieldKey}</p>
                  </div>
                  <div className="people-field-tags">
                    <Badge variant="outline">{t(registrationFieldTypeLabelKey(field.fieldType))}</Badge>
                    <Badge variant={field.isRequired ? "secondary" : "outline"}>
                      {t(field.isRequired ? "admin.registrationFields.required" : "admin.registrationFields.optional")}
                    </Badge>
                  </div>
                  {canWrite ? (
                    <div className="people-row-actions">
                      <Button type="button" variant="outline" size="sm" className="people-card-action" aria-label={isMobile ? field.label : t("common.edit")} aria-haspopup={isMobile ? "dialog" : undefined} aria-expanded={isMobile ? actionField?.id === field.id : undefined} onClick={(event) => {
                        if (isMobile) {
                          actionTriggerRef.current = event.currentTarget
                          setActionField(field)
                        } else {
                          openEdit(field)
                        }
                      }}>
                        <span>{t("common.edit")}</span>
                      </Button>
                      <ChevronRight className="people-row-chevron" aria-hidden strokeWidth={1.75} />
                      <Button type="button" variant="ghost" size="sm" className="people-delete-action" onClick={() => { setFieldPendingDelete(field) }}>
                        {t("common.delete")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
          </>
        )}
      </section>

      <PeopleMobileActionSheet
        open={isMobile && actionField !== null}
        name={actionField?.label ?? ""}
        description={actionField?.fieldKey}
        icon={FIELD_ICONS[actionField?.fieldType ?? ""] ?? Type}
        monospace
        editSubtitle={t("peopleAccess.mobileActions.editField")}
        canDelete={canWrite}
        confirming={fieldPendingDelete !== null}
        confirmTitle={t("admin.registrationFields.deleteTitle")}
        confirmDescription={t("admin.registrationFields.deleteDescription", { label: fieldPendingDelete?.label ?? "" })}
        isDeleting={isDeleting}
        returnFocus={actionTriggerRef}
        restoreFocus={dialog === null}
        onClose={() => { setActionField(null); setFieldPendingDelete(null) }}
        onEdit={() => { if (actionField) { openEdit(actionField); setActionField(null) } }}
        onRequestDelete={() => { setFieldPendingDelete(actionField) }}
        onConfirmDelete={() => { void handleDelete() }}
      />

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog()
          }
        }}
      >
        <DialogContent className="sm:max-w-md" finalFocus={isMobile ? () => actionTriggerRef.current ?? true : undefined}>
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
              <Controller
                control={form.control}
                name="fieldType"
                render={({ field }) => (
                  <Select
                    modal={false}
                    value={field.value}
                    onValueChange={(value) => {
                      if (typeof value === "string") {
                        field.onChange(value)
                      }
                    }}
                    items={FIELD_TYPE_OPTIONS.map((type) => ({
                      value: type,
                      label: t(registrationFieldTypeLabelKey(type)),
                    }))}
                  >
                    <SelectTrigger
                      id="registration-field-type"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(registrationFieldTypeLabelKey(type))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
        open={fieldPendingDelete !== null && (!isMobile || actionField === null)}
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
