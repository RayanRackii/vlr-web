import { useCallback, useEffect, useMemo, useState } from "react"
import { LoaderCircle, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { WizardPanelsStepper } from "@/components/ui/wizard-panels"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import {
  attributesToPayload,
  buildAttributesZodSchema,
  emptyAttributesFromFields,
  guidLikeIdSchema,
  type AssetFamily,
  type AssetFamilyField,
} from "@/features/assets/schemas/assetFamilySchemas"
import type {
  Asset,
  AssetStatus,
} from "@/features/assets/schemas/assetSchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import {
  bulkCreateAssets,
  createAsset,
  getAssetById,
  updateAsset,
} from "@/features/assets/services/assetsService"
import {
  createAssetPricing,
  deleteAssetPricing,
  getAssetPricings,
} from "@/features/assets/services/rentalPricingService"

export type AssetWizardProps = {
  mode: "create" | "bulk" | "edit"
  open: boolean
  onOpenChange: (open: boolean) => void
  units: Unit[]
  categories: AssetCategory[]
  families: AssetFamily[]
  assetId?: string | null
  onCompleted: () => void
  readOnly?: boolean
}

type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"

type PricingDraft = {
  localKey: string
  id?: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  pricePerHour: number
}

type WizardFormState = {
  name: string
  tag: string
  location: string
  status: AssetStatus
  unitId: string
  categoryId: string
  familyId: string
  attributes: Record<string, string>
  baseLocationName: string
  baseTag: string
  startNumber: number
  endNumber: number
  requiresMaintenance: boolean
  isRentable: boolean
  rentalType: "Location" | "Good"
  totalQuantity: number
}

const DAYS: readonly DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function newLocalKey(): string {
  return crypto.randomUUID()
}

function emptyForm(defaults?: {
  unitId?: string
  familyId?: string
  attributes?: Record<string, string>
}): WizardFormState {
  return {
    name: "",
    tag: "",
    location: "",
    status: "Active",
    unitId: defaults?.unitId ?? "",
    categoryId: "",
    familyId: defaults?.familyId ?? "",
    attributes: defaults?.attributes ?? {},
    baseLocationName: "",
    baseTag: "",
    startNumber: 1,
    endNumber: 1,
    requiresMaintenance: false,
    isRentable: false,
    rentalType: "Location",
    totalQuantity: 1,
  }
}

function attributesFromAsset(
  fields: readonly AssetFamilyField[],
  stored: Record<string, string | null> | undefined,
): Record<string, string> {
  const values = emptyAttributesFromFields(fields)
  for (const field of fields) {
    const raw = stored?.[field.key]
    if (raw != null) {
      values[field.key] = raw
    }
  }
  return values
}

function emptyPricingDraft(): PricingDraft {
  return {
    localKey: newLocalKey(),
    dayOfWeek: "Monday",
    startTime: "08:00",
    endTime: "18:00",
    pricePerHour: 0,
  }
}

export function AssetWizard({
  mode,
  open,
  onOpenChange,
  units,
  categories,
  families,
  assetId = null,
  onCompleted,
  readOnly = false,
}: AssetWizardProps) {
  const { t } = useTranslation()
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState<WizardFormState>(() => emptyForm())
  const [pricings, setPricings] = useState<PricingDraft[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadedAsset, setLoadedAsset] = useState<Asset | null>(null)

  const selectedFamily = useMemo(
    () => families.find((family) => family.id === form.familyId) ?? null,
    [families, form.familyId],
  )

  const steps = useMemo(() => {
    const base = [
      { id: "general", label: t("assets.wizard.steps.general") },
      { id: "capabilities", label: t("assets.wizard.steps.capabilities") },
    ]
    if (form.isRentable) {
      base.push({ id: "pricing", label: t("assets.wizard.steps.pricing") })
    }
    base.push({ id: "review", label: t("assets.wizard.steps.review") })
    return base
  }, [form.isRentable, t])

  const currentStepId = steps[stepIndex]?.id ?? "general"
  const isLastStep = stepIndex >= steps.length - 1

  const titleKey =
    mode === "create"
      ? "assets.wizard.title.create"
      : mode === "bulk"
        ? "assets.wizard.title.bulk"
        : "assets.wizard.title.edit"

  const resetWizard = useCallback(() => {
    const firstFamily = families[0]
    setForm(
      emptyForm({
        unitId: units[0]?.id ?? "",
        familyId: firstFamily?.id ?? "",
        attributes: emptyAttributesFromFields(firstFamily?.fields ?? []),
      }),
    )
    setPricings([])
    setStepIndex(0)
    setLoadedAsset(null)
    setIsLoading(false)
    setIsSubmitting(false)
  }, [families, units])

  const loadEditAsset = useCallback(async () => {
    if (!assetId) {
      return
    }

    setIsLoading(true)
    try {
      const asset = await getAssetById(assetId)
      const family =
        families.find((item) => item.id === asset.familyId) ?? null

      setLoadedAsset(asset)
      setForm({
        name: asset.name,
        tag: asset.tag,
        location: asset.location ?? "",
        status: asset.status as AssetStatus,
        unitId: asset.unitId,
        categoryId: asset.categoryId,
        familyId: asset.familyId,
        attributes: attributesFromAsset(
          family?.fields ?? [],
          asset.attributes,
        ),
        baseLocationName: "",
        baseTag: "",
        startNumber: 1,
        endNumber: 1,
        requiresMaintenance: asset.requiresMaintenance,
        isRentable: asset.isRentable,
        rentalType: asset.rentalConfig?.type ?? "Location",
        totalQuantity: asset.rentalConfig?.totalQuantity ?? 1,
      })

      if (asset.isRentable) {
        const rows = await getAssetPricings(asset.id)
        setPricings(
          rows.map((row) => ({
            localKey: row.id,
            id: row.id,
            dayOfWeek: row.dayOfWeek as DayOfWeek,
            startTime: row.startTime.slice(0, 5),
            endTime: row.endTime.slice(0, 5),
            pricePerHour: row.pricePerHour,
          })),
        )
      } else {
        setPricings([])
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("assets.detail.errors.loadFailed"),
      )
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }, [assetId, families, onOpenChange, t])

  useEffect(() => {
    if (!open) {
      return
    }

    setStepIndex(0)

    if (mode === "edit") {
      void loadEditAsset()
      return
    }

    resetWizard()
  }, [open, mode, loadEditAsset, resetWizard])

  useEffect(() => {
    if (stepIndex > steps.length - 1) {
      setStepIndex(Math.max(0, steps.length - 1))
    }
  }, [stepIndex, steps.length])

  function patchForm(patch: Partial<WizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function handleFamilyChange(familyId: string | null) {
    if (!familyId) {
      return
    }
    const family = families.find((item) => item.id === familyId)
    patchForm({
      familyId,
      attributes: emptyAttributesFromFields(family?.fields ?? []),
    })
  }

  function validateGeneral(): boolean {
    if (!form.unitId || !guidLikeIdSchema.safeParse(form.unitId).success) {
      toast.error(t("assets.inventory.validation.unitRequired"))
      return false
    }
    if (
      !form.categoryId ||
      !guidLikeIdSchema.safeParse(form.categoryId).success
    ) {
      toast.error(t("assets.inventory.validation.categoryRequired"))
      return false
    }
    if (!form.familyId || !guidLikeIdSchema.safeParse(form.familyId).success) {
      toast.error(t("assets.inventory.validation.familyRequired"))
      return false
    }

    if (mode === "bulk") {
      if (!form.baseLocationName.trim()) {
        toast.error(t("assets.inventory.validation.baseLocationRequired"))
        return false
      }
      if (!form.baseTag.trim()) {
        toast.error(t("assets.inventory.validation.baseTagRequired"))
        return false
      }
      if (!Number.isFinite(form.startNumber)) {
        toast.error(t("assets.inventory.validation.startNumberRequired"))
        return false
      }
      if (!Number.isFinite(form.endNumber)) {
        toast.error(t("assets.inventory.validation.endNumberRequired"))
        return false
      }
      if (form.startNumber > form.endNumber) {
        toast.error(t("assets.inventory.validation.rangeInvalid"))
        return false
      }
    } else {
      if (!form.name.trim()) {
        toast.error(t("common.required", { defaultValue: "Required" }))
        return false
      }
      if (!form.tag.trim()) {
        toast.error(t("common.required", { defaultValue: "Required" }))
        return false
      }
    }

    const attributeValidation = buildAttributesZodSchema(
      selectedFamily?.fields ?? [],
      { required: t("common.required", { defaultValue: "Required" }) },
    ).safeParse(form.attributes)

    if (!attributeValidation.success) {
      toast.error(t("common.required", { defaultValue: "Required" }))
      return false
    }

    return true
  }

  function validateCapabilities(): boolean {
    if (!form.isRentable) {
      return true
    }
    if (form.totalQuantity < 1 || !Number.isFinite(form.totalQuantity)) {
      toast.error(t("common.required", { defaultValue: "Required" }))
      return false
    }
    return true
  }

  function validatePricing(): boolean {
    for (const row of pricings) {
      if (!row.startTime || !row.endTime) {
        toast.error(t("common.required", { defaultValue: "Required" }))
        return false
      }
      if (!Number.isFinite(row.pricePerHour) || row.pricePerHour < 0) {
        toast.error(t("common.required", { defaultValue: "Required" }))
        return false
      }
    }
    return true
  }

  function validateCurrentStep(): boolean {
    switch (currentStepId) {
      case "general":
        return validateGeneral()
      case "capabilities":
        return validateCapabilities()
      case "pricing":
        return validatePricing()
      default:
        return true
    }
  }

  function handleNext() {
    if (!validateCurrentStep()) {
      return
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
  }

  function handleBack() {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  async function applyPricingsToAsset(targetAssetId: string) {
    const drafts = form.isRentable ? pricings : []
    for (const draft of drafts) {
      if (draft.id) {
        continue
      }
      await createAssetPricing(targetAssetId, {
        dayOfWeek: draft.dayOfWeek,
        startTime: draft.startTime,
        endTime: draft.endTime,
        pricePerHour: draft.pricePerHour,
        requiresDeposit: false,
        depositPercentage: 0,
      })
    }
  }

  async function handleSubmit() {
    if (readOnly) {
      return
    }
    if (!validateGeneral() || !validateCapabilities()) {
      return
    }
    if (form.isRentable && !validatePricing()) {
      return
    }

    setIsSubmitting(true)
    try {
      const attributes = attributesToPayload(
        selectedFamily?.fields ?? [],
        form.attributes,
      )

      if (mode === "create") {
        const asset = await createAsset({
          unitId: form.unitId,
          categoryId: form.categoryId,
          familyId: form.familyId,
          attributes,
          name: form.name.trim(),
          tag: form.tag.trim(),
          location: form.location.trim() || null,
          status: form.status,
          isRentable: form.isRentable,
          requiresMaintenance: form.requiresMaintenance,
          rentalType: form.rentalType,
          totalQuantity: form.totalQuantity,
        })
        if (form.isRentable) {
          await applyPricingsToAsset(asset.id)
        }
        toast.success(t("assets.wizard.success.create"))
      } else if (mode === "bulk") {
        const result = await bulkCreateAssets({
          unitId: form.unitId,
          categoryId: form.categoryId,
          familyId: form.familyId,
          attributes,
          baseLocationName: form.baseLocationName.trim(),
          baseTag: form.baseTag.trim(),
          startNumber: form.startNumber,
          endNumber: form.endNumber,
          isRentable: form.isRentable,
          requiresMaintenance: form.requiresMaintenance,
        })
        if (form.isRentable) {
          for (const asset of result.assets) {
            await applyPricingsToAsset(asset.id)
          }
        }
        toast.success(t("assets.wizard.success.bulk"))
      } else {
        if (!loadedAsset) {
          return
        }
        await updateAsset(loadedAsset.id, {
          unitId: form.unitId,
          categoryId: form.categoryId,
          familyId: form.familyId,
          attributes,
          name: form.name.trim(),
          tag: form.tag.trim(),
          location: form.location.trim() || null,
          serialNumber: loadedAsset.serialNumber ?? null,
          installationDate: loadedAsset.installationDate ?? null,
          status: form.status,
          isRentable: form.isRentable,
          requiresMaintenance: form.requiresMaintenance,
          rentalType: form.rentalType,
          totalQuantity: form.totalQuantity,
        })
        if (form.isRentable) {
          await applyPricingsToAsset(loadedAsset.id)
        }
        toast.success(t("assets.wizard.success.update"))
      }

      onCompleted()
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("assets.inventory.errors.createFailed"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRemovePricing(draft: PricingDraft) {
    if (draft.id && loadedAsset) {
      try {
        await deleteAssetPricing(loadedAsset.id, draft.id)
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("assets.detail.errors.pricingDeleteFailed"),
        )
        return
      }
    }
    setPricings((prev) => prev.filter((row) => row.localKey !== draft.localKey))
  }

  function updatePricing(
    localKey: string,
    patch: Partial<Omit<PricingDraft, "localKey" | "id">>,
  ) {
    setPricings((prev) =>
      prev.map((row) =>
        row.localKey === localKey ? { ...row, ...patch } : row,
      ),
    )
  }

  const unitName =
    units.find((unit) => unit.id === form.unitId)?.name ?? form.unitId
  const categoryName =
    categories.find((category) => category.id === form.categoryId)?.name ??
    form.categoryId
  const familyLabel = selectedFamily?.label ?? form.familyId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 border-border/80 bg-card sm:max-w-3xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl tracking-tight">{t(titleKey)}</DialogTitle>
        </DialogHeader>

        <WizardPanelsStepper
          steps={steps}
          currentIndex={stepIndex}
          onStepClick={(index) => {
            if (index < stepIndex) {
              setStepIndex(index)
            }
          }}
        />

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {t("common.loading")}
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {currentStepId === "general" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("assets.inventory.form.unit")}</Label>
                    <Select
                      modal={false}
                      value={form.unitId}
                      onValueChange={(value) => {
                        if (value) {
                          patchForm({ unitId: value })
                        }
                      }}
                      items={units.map((unit) => ({
                        value: unit.id,
                        label: unit.name,
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t(
                            "assets.inventory.form.unitPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("assets.inventory.form.category")}</Label>
                    <Select
                      modal={false}
                      value={form.categoryId}
                      onValueChange={(value) => {
                        if (value) {
                          patchForm({ categoryId: value })
                        }
                      }}
                      items={categories.map((category) => ({
                        value: category.id,
                        label: category.name,
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t(
                            "assets.inventory.form.categoryPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t("assets.inventory.form.family")}</Label>
                    <Select
                      modal={false}
                      value={form.familyId}
                      onValueChange={handleFamilyChange}
                      items={families.map((family) => ({
                        value: family.id,
                        label: family.label,
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t(
                            "assets.inventory.form.familyPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {families.map((family) => (
                          <SelectItem key={family.id} value={family.id}>
                            {family.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {mode === "bulk" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t("assets.inventory.form.baseLocation")}</Label>
                      <Input
                        value={form.baseLocationName}
                        onChange={(event) => {
                          patchForm({ baseLocationName: event.target.value })
                        }}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t("assets.inventory.form.baseTag")}</Label>
                      <Input
                        value={form.baseTag}
                        onChange={(event) => {
                          patchForm({ baseTag: event.target.value })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("assets.inventory.form.startNumber")}</Label>
                      <Input
                        type="number"
                        value={form.startNumber}
                        onChange={(event) => {
                          patchForm({
                            startNumber: event.target.valueAsNumber,
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("assets.inventory.form.endNumber")}</Label>
                      <Input
                        type="number"
                        value={form.endNumber}
                        onChange={(event) => {
                          patchForm({
                            endNumber: event.target.valueAsNumber,
                          })
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("assets.detail.fields.name")}</Label>
                      <Input
                        value={form.name}
                        onChange={(event) => {
                          patchForm({ name: event.target.value })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("assets.detail.fields.tag")}</Label>
                      <Input
                        value={form.tag}
                        onChange={(event) => {
                          patchForm({ tag: event.target.value })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("assets.detail.fields.location")}</Label>
                      <Input
                        value={form.location}
                        onChange={(event) => {
                          patchForm({ location: event.target.value })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("assets.detail.fields.status")}</Label>
                      <Select
                        modal={false}
                        value={form.status}
                        onValueChange={(value) => {
                          if (value) {
                            patchForm({ status: value as AssetStatus })
                          }
                        }}
                        items={[
                          {
                            value: "Active",
                            label: t("assets.inventory.status.Active"),
                          },
                          {
                            value: "Inactive",
                            label: t("assets.inventory.status.Inactive"),
                          },
                          {
                            value: "Maintenance",
                            label: t("assets.inventory.status.Maintenance"),
                          },
                        ]}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">
                            {t("assets.inventory.status.Active")}
                          </SelectItem>
                          <SelectItem value="Inactive">
                            {t("assets.inventory.status.Inactive")}
                          </SelectItem>
                          <SelectItem value="Maintenance">
                            {t("assets.inventory.status.Maintenance")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {selectedFamily && selectedFamily.fields.length > 0 ? (
                  <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                    {selectedFamily.fields.map((familyField) => (
                      <div key={familyField.key} className="space-y-2">
                        <Label>
                          {t(`assets.wizard.familyFields.${familyField.key}`, {
                            defaultValue:
                              familyField.label ?? familyField.key,
                          })}
                          {!familyField.required
                            ? ` (${t("common.optional")})`
                            : null}
                        </Label>
                        {familyField.type === "boolean" ? (
                          <Switch
                            checked={
                              form.attributes[familyField.key] === "true"
                            }
                            onCheckedChange={(checked) => {
                              patchForm({
                                attributes: {
                                  ...form.attributes,
                                  [familyField.key]: checked
                                    ? "true"
                                    : "false",
                                },
                              })
                            }}
                          />
                        ) : (
                          <Input
                            type={
                              familyField.type === "number" ? "number" : "text"
                            }
                            value={form.attributes[familyField.key] ?? ""}
                            onChange={(event) => {
                              patchForm({
                                attributes: {
                                  ...form.attributes,
                                  [familyField.key]: event.target.value,
                                },
                              })
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStepId === "capabilities" ? (
              <div className="space-y-4">
                <div className="grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{t("assets.detail.fields.requiresMaintenance")}</Label>
                    <Switch
                      checked={form.requiresMaintenance}
                      onCheckedChange={(checked) => {
                        patchForm({ requiresMaintenance: checked })
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label>{t("assets.detail.fields.isRentable")}</Label>
                    <Switch
                      checked={form.isRentable}
                      onCheckedChange={(checked) => {
                        patchForm({ isRentable: checked })
                        if (!checked) {
                          setPricings((prev) =>
                            prev.filter((row) => Boolean(row.id)),
                          )
                        }
                      }}
                    />
                  </div>
                </div>

                {form.isRentable ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("assets.detail.fields.rentalType")}</Label>
                      <Select
                        modal={false}
                        value={form.rentalType}
                        onValueChange={(value) => {
                          if (value) {
                            patchForm({
                              rentalType: value as "Location" | "Good",
                            })
                          }
                        }}
                        items={[
                          {
                            value: "Location",
                            label: t("assets.detail.rentalTypes.Location"),
                          },
                          {
                            value: "Good",
                            label: t("assets.detail.rentalTypes.Good"),
                          },
                        ]}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Location">
                            {t("assets.detail.rentalTypes.Location")}
                          </SelectItem>
                          <SelectItem value="Good">
                            {t("assets.detail.rentalTypes.Good")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("assets.detail.fields.totalQuantity")}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.totalQuantity}
                        onChange={(event) => {
                          patchForm({
                            totalQuantity: event.target.valueAsNumber,
                          })
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStepId === "pricing" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {t("assets.detail.rental.pricingTitle")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPricings((prev) => [...prev, emptyPricingDraft()])
                    }}
                  >
                    <Plus className="size-4" />
                    {t("assets.detail.rental.addPricing")}
                  </Button>
                </div>

                {pricings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("assets.detail.rental.pricingEmpty")}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {pricings.map((row) => (
                      <li
                        key={row.localKey}
                        className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
                      >
                        <div className="space-y-1">
                          <Label>{t("assets.detail.rental.dayOfWeek")}</Label>
                          <Select
                            modal={false}
                            value={row.dayOfWeek}
                            onValueChange={(value) => {
                              if (value) {
                                updatePricing(row.localKey, {
                                  dayOfWeek: value as DayOfWeek,
                                })
                              }
                            }}
                            items={DAYS.map((day) => ({
                              value: day,
                              label: t(`assets.detail.days.${day}`),
                            }))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS.map((day) => (
                                <SelectItem key={day} value={day}>
                                  {t(`assets.detail.days.${day}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>{t("assets.detail.rental.startTime")}</Label>
                          <Input
                            type="time"
                            value={row.startTime}
                            onChange={(event) => {
                              updatePricing(row.localKey, {
                                startTime: event.target.value,
                              })
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>{t("assets.detail.rental.endTime")}</Label>
                          <Input
                            type="time"
                            value={row.endTime}
                            onChange={(event) => {
                              updatePricing(row.localKey, {
                                endTime: event.target.value,
                              })
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>{t("assets.detail.rental.pricePerHour")}</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.pricePerHour}
                            onChange={(event) => {
                              updatePricing(row.localKey, {
                                pricePerHour: event.target.valueAsNumber,
                              })
                            }}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              void handleRemovePricing(row)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {currentStepId === "review" ? (
              <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {t("assets.inventory.form.unit")}:{" "}
                  </span>
                  {unitName}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("assets.inventory.form.category")}:{" "}
                  </span>
                  {categoryName}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("assets.inventory.form.family")}:{" "}
                  </span>
                  {familyLabel}
                </p>
                {mode === "bulk" ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.inventory.form.baseLocation")}:{" "}
                      </span>
                      {form.baseLocationName}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.inventory.form.baseTag")}:{" "}
                      </span>
                      {form.baseTag}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.inventory.form.startNumber")}–
                        {t("assets.inventory.form.endNumber")}:{" "}
                      </span>
                      {form.startNumber}–{form.endNumber}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.detail.fields.name")}:{" "}
                      </span>
                      {form.name}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.detail.fields.tag")}:{" "}
                      </span>
                      {form.tag}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.detail.fields.location")}:{" "}
                      </span>
                      {form.location || t("assets.inventory.emptyValue")}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.detail.fields.status")}:{" "}
                      </span>
                      {t(`assets.inventory.status.${form.status}`)}
                    </p>
                  </>
                )}
                <p>
                  <span className="text-muted-foreground">
                    {t("assets.detail.fields.requiresMaintenance")}:{" "}
                  </span>
                  {form.requiresMaintenance
                    ? t("common.yes", { defaultValue: "Yes" })
                    : t("common.no", { defaultValue: "No" })}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("assets.detail.fields.isRentable")}:{" "}
                  </span>
                  {form.isRentable
                    ? t("common.yes", { defaultValue: "Yes" })
                    : t("common.no", { defaultValue: "No" })}
                </p>
                {form.isRentable ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.detail.fields.rentalType")}:{" "}
                      </span>
                      {t(`assets.detail.rentalTypes.${form.rentalType}`)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.detail.fields.totalQuantity")}:{" "}
                      </span>
                      {form.totalQuantity}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.detail.rental.pricingTitle")}:{" "}
                      </span>
                      {pricings.length}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={stepIndex === 0 || isLoading || isSubmitting}
            onClick={handleBack}
          >
            {t("assets.wizard.back")}
          </Button>
          <div className="flex gap-2">
            {isLastStep ? (
              <Button
                type="button"
                disabled={isLoading || isSubmitting || readOnly}
                onClick={() => {
                  void handleSubmit()
                }}
              >
                {isSubmitting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {t("assets.wizard.finish")}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={isLoading || isSubmitting}
                onClick={handleNext}
              >
                {t("assets.wizard.next")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
