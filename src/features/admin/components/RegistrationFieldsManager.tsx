import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import {
  FIELD_TYPE_OPTIONS,
  type RegistrationField,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  createRegistrationField,
  deleteRegistrationField,
  listAdminRegistrationFields,
  listTenantRegistrationFields,
} from "@/features/tenantPortal/services/tenantPortalService"

type RegistrationFieldsManagerProps = {
  /** When set, uses platform-admin endpoints for that tenant. */
  tenantId?: string
}

export function RegistrationFieldsManager({
  tenantId,
}: RegistrationFieldsManagerProps) {
  const { t } = useTranslation()
  const [fields, setFields] = useState<RegistrationField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fieldKey, setFieldKey] = useState("")
  const [label, setLabel] = useState("")
  const [fieldType, setFieldType] = useState<string>("text")
  const [isRequired, setIsRequired] = useState(false)
  const [optionsCsv, setOptionsCsv] = useState("")

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

  async function handleCreate() {
    setSaving(true)
    try {
      const options =
        fieldType === "select"
          ? optionsCsv
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
          : null

      await createRegistrationField(
        {
          fieldKey: fieldKey.trim(),
          label: label.trim(),
          fieldType,
          isRequired,
          sortOrder: fields.length,
          options,
        },
        tenantId,
      )
      toast.success(t("admin.registrationFields.createSuccess"))
      setFieldKey("")
      setLabel("")
      setOptionsCsv("")
      setIsRequired(false)
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.registrationFields.createError"),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await deleteRegistrationField(id, tenantId)
      toast.success(t("admin.registrationFields.deleteSuccess"))
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.registrationFields.deleteError"),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">
          {t("admin.registrationFields.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("admin.registrationFields.description")}
        </p>
      </div>

      {loading ? (
        <PageContentSkeleton rows={3} />
      ) : fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("admin.registrationFields.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field) => (
            <li
              key={field.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {field.label}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({field.fieldKey})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {field.fieldType}
                  {field.isRequired
                    ? ` · ${t("admin.registrationFields.required")}`
                    : ` · ${t("common.optional")}`}
                </p>
              </div>
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                loading={saving}
                onClick={() => {
                  void handleDelete(field.id)
                }}
              >
                {t("common.delete")}
              </LoadingButton>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
        <Input
          placeholder={t("admin.registrationFields.fieldKey")}
          value={fieldKey}
          onChange={(event) => {
            setFieldKey(event.target.value)
          }}
        />
        <Input
          placeholder={t("admin.registrationFields.label")}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value)
          }}
        />
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={fieldType}
          onChange={(event) => {
            setFieldType(event.target.value)
          }}
        >
          {FIELD_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(event) => {
              setIsRequired(event.target.checked)
            }}
          />
          {t("admin.registrationFields.required")}
        </label>
        {fieldType === "select" ? (
          <Input
            className="sm:col-span-2"
            placeholder={t("admin.registrationFields.optionsPlaceholder")}
            value={optionsCsv}
            onChange={(event) => {
              setOptionsCsv(event.target.value)
            }}
          />
        ) : null}
        <LoadingButton
          type="button"
          className="sm:col-span-2"
          loading={saving}
          disabled={fieldKey.trim().length < 2 || label.trim().length < 1}
          onClick={() => {
            void handleCreate()
          }}
        >
          {t("admin.registrationFields.add")}
        </LoadingButton>
      </div>
    </div>
  )
}
