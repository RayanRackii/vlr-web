import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldLabel } from "@/components/ui/field-label"
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
import { cn } from "@/lib/utils"
import {
  emptyPricingEditor,
  expandPricingEditor,
  isPricingEditorValid,
  pricingEditorFromRows,
  type PricingEditorState,
} from "@/features/assets/components/assetWizardPricing"
import { AssetWizardPricingStep } from "@/features/assets/components/AssetWizardPricingStep"
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
  bulkApplyAssetPricings,
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
  requiresDeposit: boolean
  rentalType: "Location" | "Good"
  totalQuantity: number
}

type FieldErrorKey =
  | "unitId"
  | "categoryId"
  | "familyId"
  | "name"
  | "tag"
  | "baseLocationName"
  | "baseTag"
  | "startNumber"
  | "endNumber"
  | "totalQuantity"
  | "attributes"
  | "pricing"

function displayUnitName(name: string, translate: (key: string) => string): string {
  if (name.trim().toLowerCase() === "headquarters") {
    return translate("assets.units.matrizDefault")
  }
  return name
}

function fieldInvalidClass(invalid: boolean): string {
  return invalid ? "border-destructive focus-visible:border-destructive" : ""
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
    requiresDeposit: true,
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
  const [pricing, setPricing] = useState<PricingEditorState>(emptyPricingEditor)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadedAsset, setLoadedAsset] = useState<Asset | null>(null)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldErrorKey, boolean>>
  >({})

  const selectedFamily = useMemo(
    () => families.find((family) => family.id === form.familyId) ?? null,
    [families, form.familyId],
  )

  const steps = useMemo(() => {
    const base = [
      { id: "general", label: t("assets.wizard.steps.general") },
      { id: "operation", label: t("assets.wizard.steps.operation") },
    ]
    if (form.isRentable) {
      base.push({ id: "pricing", label: t("assets.wizard.steps.pricing") })
    }
    base.push({ id: "review", label: t("assets.wizard.steps.review") })
    return base
  }, [form.isRentable, t])

  const currentStepId = steps[stepIndex]?.id ?? "general"
  const isLastStep = stepIndex >= steps.length - 1
  const isBulkLocation = mode === "bulk" && form.rentalType === "Location"
  const isBulkGood = mode === "bulk" && form.rentalType === "Good"

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
    setPricing(emptyPricingEditor())
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
        requiresDeposit: asset.rentalConfig?.requiresDeposit ?? true,
        rentalType: asset.rentalConfig?.type ?? "Location",
        totalQuantity: asset.rentalConfig?.totalQuantity ?? 1,
      })

      if (asset.isRentable) {
        const rows = await getAssetPricings(asset.id)
        setPricing(
          pricingEditorFromRows(
            rows.map((row) => ({
              dayOfWeek: row.dayOfWeek,
              startTime: row.startTime.slice(0, 5),
              endTime: row.endTime.slice(0, 5),
              pricePerHour: row.pricePerHour,
            })),
          ),
        )
      } else {
        setPricing(emptyPricingEditor())
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

  const sessionOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      sessionOpenRef.current = false
      return
    }

    if (sessionOpenRef.current) {
      return
    }
    sessionOpenRef.current = true
    setStepIndex(0)
    setFieldErrors({})

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
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch) as (keyof WizardFormState)[]) {
        if (key in next) {
          delete next[key as FieldErrorKey]
        }
        if (key === "attributes") {
          delete next.attributes
        }
      }
      return next
    })
  }

  function markErrors(keys: FieldErrorKey[]) {
    setFieldErrors(
      Object.fromEntries(keys.map((key) => [key, true])) as Partial<
        Record<FieldErrorKey, boolean>
      >,
    )
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
    const errors: FieldErrorKey[] = []

    if (!form.unitId || !guidLikeIdSchema.safeParse(form.unitId).success) {
      errors.push("unitId")
    }
    if (
      !form.categoryId ||
      !guidLikeIdSchema.safeParse(form.categoryId).success
    ) {
      errors.push("categoryId")
    }
    if (!form.familyId || !guidLikeIdSchema.safeParse(form.familyId).success) {
      errors.push("familyId")
    }

    if (mode === "bulk") {
      if (!form.baseLocationName.trim()) {
        errors.push("baseLocationName")
      }
      if (!form.baseTag.trim()) {
        errors.push("baseTag")
      }
      if (form.rentalType === "Location") {
        if (!Number.isFinite(form.startNumber)) {
          errors.push("startNumber")
        }
        if (!Number.isFinite(form.endNumber)) {
          errors.push("endNumber")
        }
        if (
          Number.isFinite(form.startNumber) &&
          Number.isFinite(form.endNumber) &&
          form.startNumber > form.endNumber
        ) {
          errors.push("startNumber", "endNumber")
        }
      } else if (
        form.totalQuantity < 1 ||
        !Number.isFinite(form.totalQuantity)
      ) {
        errors.push("totalQuantity")
      }
    } else {
      if (!form.name.trim()) {
        errors.push("name")
      }
      if (!form.tag.trim()) {
        errors.push("tag")
      }
    }

    const attributeValidation = buildAttributesZodSchema(
      selectedFamily?.fields ?? [],
      { required: t("common.required") },
    ).safeParse(form.attributes)

    if (!attributeValidation.success) {
      errors.push("attributes")
    }

    if (errors.length > 0) {
      markErrors(errors)
      toast.error(
        errors.includes("totalQuantity") && mode === "bulk"
          ? t("assets.inventory.validation.stockQuantityRequired")
          : t("common.required"),
      )
      return false
    }

    setFieldErrors({})
    return true
  }

  function validateCapabilities(): boolean {
    if (!form.isRentable) {
      return true
    }
    if (
      mode !== "bulk" &&
      (form.totalQuantity < 1 || !Number.isFinite(form.totalQuantity))
    ) {
      markErrors(["totalQuantity"])
      toast.error(t("assets.inventory.validation.quantityRequired"))
      return false
    }
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.totalQuantity
      return next
    })
    return true
  }

  function validatePricing(): boolean {
    if (!isPricingEditorValid(pricing)) {
      markErrors(["pricing"])
      toast.error(t("assets.inventory.validation.pricingRequired"))
      return false
    }
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.pricing
      return next
    })
    return true
  }

  function validateCurrentStep(): boolean {
    switch (currentStepId) {
      case "general":
        return validateGeneral()
      case "operation":
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

      const pricingRows = form.isRentable
        ? expandPricingEditor(pricing).map((draft) => ({
            dayOfWeek: draft.dayOfWeek,
            startTime: draft.startTime,
            endTime: draft.endTime,
            pricePerHour: draft.pricePerHour,
            requiresDeposit: false,
            depositPercentage: 0,
          }))
        : null

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
          requiresDeposit: form.requiresDeposit,
        })
        if (pricingRows) {
          await bulkApplyAssetPricings({
            assetIds: [asset.id],
            pricings: pricingRows,
            replace: true,
          })
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
          startNumber: isBulkLocation ? form.startNumber : null,
          endNumber: isBulkLocation ? form.endNumber : null,
          rentalType: form.rentalType,
          totalQuantity: isBulkGood ? form.totalQuantity : 1,
          isRentable: form.isRentable,
          requiresMaintenance: form.requiresMaintenance,
          requiresDeposit: form.requiresDeposit,
        })
        if (pricingRows) {
          await bulkApplyAssetPricings({
            assetIds: result.assets.map((asset) => asset.id),
            pricings: pricingRows,
            replace: true,
          })
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
          requiresDeposit: form.requiresDeposit,
        })
        if (pricingRows) {
          await bulkApplyAssetPricings({
            assetIds: [loadedAsset.id],
            pricings: pricingRows,
            replace: true,
          })
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

  const unitName = displayUnitName(
    units.find((unit) => unit.id === form.unitId)?.name ?? form.unitId,
    t,
  )
  const categoryName =
    categories.find((category) => category.id === form.categoryId)?.name ??
    form.categoryId
  const familyLabel = selectedFamily?.label ?? form.familyId

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(next, details) => {
        if (
          !next &&
          (details.reason === "outside-press" || details.reason === "focus-out")
        ) {
          return
        }
        onOpenChange(next)
      }}
    >
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
                    <FieldLabel
                      label={t("assets.inventory.form.unit")}
                      help={t("assets.wizard.help.unit")}
                      required
                    />
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
                        label: displayUnitName(unit.name, t),
                      }))}
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full",
                          fieldInvalidClass(Boolean(fieldErrors.unitId)),
                        )}
                        aria-invalid={fieldErrors.unitId || undefined}
                      >
                        <SelectValue
                          placeholder={t(
                            "assets.inventory.form.unitPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {displayUnitName(unit.name, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.unitId ? (
                      <p className="text-xs text-destructive">
                        {t("assets.inventory.validation.unitRequired")}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <FieldLabel
                      label={t("assets.inventory.form.category")}
                      help={t("assets.wizard.help.category")}
                      required
                    />
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
                      <SelectTrigger
                        className={cn(
                          "w-full",
                          fieldInvalidClass(Boolean(fieldErrors.categoryId)),
                        )}
                        aria-invalid={fieldErrors.categoryId || undefined}
                      >
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
                    {fieldErrors.categoryId ? (
                      <p className="text-xs text-destructive">
                        {t("assets.inventory.validation.categoryRequired")}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <FieldLabel
                      label={t("assets.inventory.form.family")}
                      help={t("assets.wizard.help.family")}
                      required
                    />
                    <Select
                      modal={false}
                      value={form.familyId}
                      onValueChange={handleFamilyChange}
                      items={families.map((family) => ({
                        value: family.id,
                        label: family.label,
                      }))}
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full",
                          fieldInvalidClass(Boolean(fieldErrors.familyId)),
                        )}
                        aria-invalid={fieldErrors.familyId || undefined}
                      >
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
                    {fieldErrors.familyId ? (
                      <p className="text-xs text-destructive">
                        {t("assets.inventory.validation.familyRequired")}
                      </p>
                    ) : null}
                  </div>
                </div>

                {mode === "bulk" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <FieldLabel
                        label={t("assets.detail.fields.rentalType")}
                        help={t("assets.wizard.help.rentalType")}
                      />
                      <Select
                        modal={false}
                        value={form.rentalType}
                        onValueChange={(value) => {
                          if (value === "Location" || value === "Good") {
                            setForm((prev) => ({
                              ...prev,
                              rentalType: value,
                            }))
                            setFieldErrors((prev) => {
                              const next = { ...prev }
                              delete next.startNumber
                              delete next.endNumber
                              delete next.totalQuantity
                              return next
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
                    <div className="space-y-2 sm:col-span-2">
                      <FieldLabel
                        label={t("assets.inventory.form.baseLocation")}
                        help={t("assets.wizard.help.baseLocation")}
                        required
                      />
                      <Input
                        value={form.baseLocationName}
                        placeholder={t(
                          "assets.inventory.form.baseLocationPlaceholder.generic",
                        )}
                        aria-invalid={fieldErrors.baseLocationName || undefined}
                        className={fieldInvalidClass(
                          Boolean(fieldErrors.baseLocationName),
                        )}
                        onChange={(event) => {
                          patchForm({ baseLocationName: event.target.value })
                        }}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <FieldLabel
                        label={t("assets.inventory.form.baseTag")}
                        help={t("assets.wizard.help.baseTag")}
                        required
                      />
                      <Input
                        value={form.baseTag}
                        placeholder={t(
                          "assets.inventory.form.baseTagPlaceholder.generic",
                        )}
                        aria-invalid={fieldErrors.baseTag || undefined}
                        className={fieldInvalidClass(
                          Boolean(fieldErrors.baseTag),
                        )}
                        onChange={(event) => {
                          patchForm({ baseTag: event.target.value })
                        }}
                      />
                    </div>
                    {isBulkGood ? (
                      <div className="space-y-2 sm:col-span-2">
                        <FieldLabel
                          label={t("assets.inventory.form.stockQuantity")}
                          help={t("assets.wizard.help.stockQuantity")}
                          required
                        />
                        <Input
                          type="number"
                          min={1}
                          value={form.totalQuantity}
                          aria-invalid={fieldErrors.totalQuantity || undefined}
                          className={fieldInvalidClass(
                            Boolean(fieldErrors.totalQuantity),
                          )}
                          onChange={(event) => {
                            patchForm({
                              totalQuantity: event.target.valueAsNumber,
                            })
                          }}
                        />
                        {fieldErrors.totalQuantity ? (
                          <p className="text-xs text-destructive">
                            {t(
                              "assets.inventory.validation.stockQuantityRequired",
                            )}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <FieldLabel
                            label={t("assets.inventory.form.startNumber")}
                            help={t("assets.wizard.help.startNumber")}
                            required
                          />
                          <Input
                            type="number"
                            value={form.startNumber}
                            aria-invalid={
                              fieldErrors.startNumber || undefined
                            }
                            className={fieldInvalidClass(
                              Boolean(fieldErrors.startNumber),
                            )}
                            onChange={(event) => {
                              patchForm({
                                startNumber: event.target.valueAsNumber,
                              })
                            }}
                          />
                          {fieldErrors.startNumber ? (
                            <p className="text-xs text-destructive">
                              {form.startNumber > form.endNumber
                                ? t("assets.inventory.validation.rangeInvalid")
                                : t(
                                    "assets.inventory.validation.startNumberRequired",
                                  )}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <FieldLabel
                            label={t("assets.inventory.form.endNumber")}
                            help={t("assets.wizard.help.endNumber")}
                            required
                          />
                          <Input
                            type="number"
                            value={form.endNumber}
                            aria-invalid={fieldErrors.endNumber || undefined}
                            className={fieldInvalidClass(
                              Boolean(fieldErrors.endNumber),
                            )}
                            onChange={(event) => {
                              patchForm({
                                endNumber: event.target.valueAsNumber,
                              })
                            }}
                          />
                          {fieldErrors.endNumber ? (
                            <p className="text-xs text-destructive">
                              {form.startNumber > form.endNumber
                                ? t("assets.inventory.validation.rangeInvalid")
                                : t(
                                    "assets.inventory.validation.endNumberRequired",
                                  )}
                            </p>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel
                        label={t("assets.detail.fields.name")}
                        help={t("assets.wizard.help.name")}
                        required
                      />
                      <Input
                        value={form.name}
                        placeholder={t("assets.wizard.placeholders.name")}
                        aria-invalid={fieldErrors.name || undefined}
                        className={fieldInvalidClass(Boolean(fieldErrors.name))}
                        onChange={(event) => {
                          patchForm({ name: event.target.value })
                        }}
                      />
                      {fieldErrors.name ? (
                        <p className="text-xs text-destructive">
                          {t("assets.inventory.validation.nameRequired")}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <FieldLabel
                        label={t("assets.detail.fields.tag")}
                        help={t("assets.wizard.help.tag")}
                        required
                      />
                      <Input
                        value={form.tag}
                        placeholder={t("assets.wizard.placeholders.tag")}
                        aria-invalid={fieldErrors.tag || undefined}
                        className={fieldInvalidClass(Boolean(fieldErrors.tag))}
                        onChange={(event) => {
                          patchForm({ tag: event.target.value })
                        }}
                      />
                      {fieldErrors.tag ? (
                        <p className="text-xs text-destructive">
                          {t("assets.inventory.validation.tagRequired")}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <FieldLabel
                        label={t("assets.detail.fields.location")}
                        help={t("assets.wizard.help.location")}
                      />
                      <Input
                        value={form.location}
                        placeholder={t("assets.wizard.placeholders.location")}
                        onChange={(event) => {
                          patchForm({ location: event.target.value })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel
                        label={t("assets.detail.fields.status")}
                        help={t("assets.wizard.help.status")}
                      />
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

            {currentStepId === "operation" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={form.requiresMaintenance}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                      form.requiresMaintenance
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-muted/40",
                    )}
                    onClick={() => {
                      patchForm({
                        requiresMaintenance: !form.requiresMaintenance,
                      })
                    }}
                  >
                    <div className="min-w-0 space-y-1">
                      <FieldLabel
                        label={t("assets.detail.fields.requiresMaintenance")}
                        help={t("assets.wizard.help.requiresMaintenance")}
                        className="pointer-events-auto"
                      />
                      <p className="text-xs text-muted-foreground">
                        {form.requiresMaintenance
                          ? t("assets.wizard.toggle.on")
                          : t("assets.wizard.toggle.off")}
                      </p>
                    </div>
                    <Switch
                      checked={form.requiresMaintenance}
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                  </button>
                  <button
                    type="button"
                    aria-pressed={form.isRentable}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                      form.isRentable
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-muted/40",
                    )}
                    onClick={() => {
                      const next = !form.isRentable
                      patchForm({ isRentable: next })
                    }}
                  >
                    <div className="min-w-0 space-y-1">
                      <FieldLabel
                        label={t("assets.detail.fields.isRentable")}
                        help={t("assets.wizard.help.isRentable")}
                        className="pointer-events-auto"
                      />
                      <p className="text-xs text-muted-foreground">
                        {form.isRentable
                          ? t("assets.wizard.toggle.on")
                          : t("assets.wizard.toggle.off")}
                      </p>
                    </div>
                    <Switch
                      checked={form.isRentable}
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                  </button>
                </div>

                {form.requiresMaintenance ? (
                  <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    {t("assets.wizard.help.requiresMaintenanceHint")}
                  </p>
                ) : null}

                {form.isRentable ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      aria-pressed={form.requiresDeposit}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                        form.requiresDeposit
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/40",
                      )}
                      onClick={() => {
                        patchForm({ requiresDeposit: !form.requiresDeposit })
                      }}
                    >
                      <div className="min-w-0 space-y-1">
                        <FieldLabel
                          label={t("assets.detail.fields.requiresDeposit")}
                          help={t("assets.wizard.help.requiresDeposit")}
                          className="pointer-events-auto"
                        />
                        <p className="text-xs text-muted-foreground">
                          {form.requiresDeposit
                            ? t("assets.wizard.toggle.on")
                            : t("assets.wizard.toggle.off")}
                        </p>
                      </div>
                      <Switch
                        checked={form.requiresDeposit}
                        tabIndex={-1}
                        className="pointer-events-none"
                      />
                    </button>
                    {mode !== "bulk" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel
                        label={t("assets.detail.fields.rentalType")}
                        help={t("assets.wizard.help.rentalType")}
                      />
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
                      <FieldLabel
                        label={t("assets.detail.fields.totalQuantity")}
                        help={t("assets.wizard.help.totalQuantity")}
                        required
                      />
                      <Input
                        type="number"
                        min={1}
                        value={form.totalQuantity}
                        aria-invalid={fieldErrors.totalQuantity || undefined}
                        className={fieldInvalidClass(
                          Boolean(fieldErrors.totalQuantity),
                        )}
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
              </div>
            ) : null}

            {currentStepId === "pricing" ? (
              <AssetWizardPricingStep
                pricing={pricing}
                invalid={Boolean(fieldErrors.pricing)}
                onChange={(patch) => {
                  setPricing((prev) => ({ ...prev, ...patch }))
                  setFieldErrors((prev) => {
                    if (!prev.pricing) {
                      return prev
                    }
                    const next = { ...prev }
                    delete next.pricing
                    return next
                  })
                }}
              />
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
                        {t("assets.detail.fields.rentalType")}:{" "}
                      </span>
                      {t(`assets.detail.rentalTypes.${form.rentalType}`)}
                    </p>
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
                    {isBulkGood ? (
                      <p>
                        <span className="text-muted-foreground">
                          {t("assets.wizard.review.stockQuantity")}:{" "}
                        </span>
                        {form.totalQuantity}
                      </p>
                    ) : (
                      <p>
                        <span className="text-muted-foreground">
                          {t("assets.inventory.form.startNumber")}–
                          {t("assets.inventory.form.endNumber")}:{" "}
                        </span>
                        {form.startNumber}–{form.endNumber}
                      </p>
                    )}
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
                        {t("assets.detail.fields.requiresDeposit")}:{" "}
                      </span>
                      {form.requiresDeposit
                        ? t("common.yes", { defaultValue: "Yes" })
                        : t("common.no", { defaultValue: "No" })}
                    </p>
                    {mode !== "bulk" ? (
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
                      </>
                    ) : null}
                    <p>
                      <span className="text-muted-foreground">
                        {t("assets.detail.rental.pricingTitle")}:{" "}
                      </span>
                      {t(
                        `assets.wizard.pricing.patterns.${pricing.pattern}.title`,
                      )}
                      {" · "}
                      {pricing.startTime}–{pricing.endTime}
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
              <LoadingButton
                type="button"
                loading={isSubmitting}
                disabled={isLoading || readOnly}
                onClick={() => {
                  void handleSubmit()
                }}
              >
                {t("assets.wizard.finish")}
              </LoadingButton>
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
