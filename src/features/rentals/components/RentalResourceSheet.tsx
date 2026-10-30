import type { PricingUnit } from "@/api/generated/rentalPricing"
import { LiveFieldMessage } from "@/features/pmoc/components/FormValidationSummary"
import { issueMessageAt } from "@/features/pmoc/lib/formIssues"
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { CircleX, LayoutTemplate } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InlineCreateSelect } from "@/components/inline-create/InlineCreateSelect"
import { FieldHelp } from "@/components/ui/field-label"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import {
  Form,
  FormControl,
  FormDescription,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import {
  BOOKING_HORIZON_DAY_MAX,
  BOOKING_HORIZON_DAY_MIN,
} from "@/features/rentals/schemas/bookingPolicySchemas"
import {
  RESOURCE_CAPACITY_PEOPLE_MAX, createRentalResourceFormSchema, type RegistryCategoryListItem, type RentalResourceFormValues, type ResourceHorizonMode } from "@/features/rentals/schemas/rentalResourceSchemas"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { listPickerTags, listVisualTemplates, type VisualTag, type VisualTemplate } from "@/features/rentals/services/resourceVisualService"
import { listRentalAssetCategories } from "@/features/rentals/services/rentalResourcesService"
import { InlineCreateCategoryForm, InlineCreateUnitForm, InlineCreateVisualTemplateForm } from "@/features/rentals/components/ResourceDependencyInlineCreateForms"
import {
  buildRentalResourceFormValues,
  getTemplateRevisionFormDefaults,
  mergeTemplateOptions,
  type TemplateDefaultField,
  type TemplateOption,
} from "@/features/rentals/components/rentalResourceFormDefaults"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { RentalResourceDetails } from "@/features/rentals/components/RentalResourceDetails"
import { useVisibleFormIssues } from "@/lib/useVisibleFormIssues"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { VISUAL_ICON_MAP } from "@/features/rentals/components/layout/resourceVisualIconMap"
import "./rentalResources.css"

type RentalResourceSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: AdminRentalAsset | null
  units: readonly Unit[]
  categories: readonly RegistryCategoryListItem[]
  families: readonly AssetFamily[]
  busy: boolean
  readOnly: boolean
  pricePerHour?: number | null
  pricingUnit?: PricingUnit
  onSubmit: (values: RentalResourceFormValues) => Promise<boolean>
}

type ResourceChoiceGroupProps = Pick<ComponentProps<"div">, "id" | "aria-describedby" | "aria-invalid"> & {
  name: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  onBlur: () => void
  disabled: boolean
  segmented?: boolean
}

function ResourceChoiceGroup({ name, label, value, options, onChange, onBlur, disabled, segmented = false, ...props }: ResourceChoiceGroupProps) {
  return (
    <div {...props} role="radiogroup" aria-label={label} className={segmented ? "resource-choices resource-choices-segmented" : "resource-choices"}>
      {options.map((option) => (
        <label key={option.value} className="resource-choice" data-checked={value === option.value}>
          <input type="radio" name={name} value={option.value} checked={value === option.value}
            disabled={disabled} onChange={() => onChange(option.value)} onBlur={onBlur}
            aria-describedby={props["aria-describedby"]} aria-invalid={props["aria-invalid"]} />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

/** Form fields rendered outside the "basic" sheet tab, used to reveal the tab holding a validation error. */
const SHEET_BASIC_FIELDS_EXCLUDED = {
  pricing: new Set([
    "cancelCutoffHours",
    "cancelCutoffMode",
    "horizonDays",
    "horizonMode",
    "queueEnabled",
    "queueOpeningTime",
    "requiresDeposit",
  ]),
  visual: new Set(["capacityPeople", "confirmVisualSuggestions", "visualTemplateRevisionId"]),
}

export function RentalResourceSheet({
  open,
  onOpenChange,
  editing,
  units,
  categories,
  families,
  busy,
  readOnly,
  pricePerHour,
  pricingUnit,
  onSubmit,
}: RentalResourceSheetProps) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const isPlatformAdmin = useIsPlatformAdmin()
  const [templates, setTemplates] = useState<VisualTemplate[]>([])
  const [unitOptions, setUnitOptions] = useState<readonly Unit[]>(units)
  const [previousUnits, setPreviousUnits] = useState(units)
  const [categoryOptions, setCategoryOptions] = useState<readonly RegistryCategoryListItem[]>(categories)
  const [previousCategories, setPreviousCategories] = useState(categories)
  const [tags, setTags] = useState<VisualTag[]>([])
  const [createdTemplateOptions, setCreatedTemplateOptions] = useState<TemplateOption[]>([])
  const [templateSearch, setTemplateSearch] = useState("")
  const [allSegments, setAllSegments] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [sheetTab, setSheetTab] = useState<"basic" | "pricing" | "visual">("basic")
  const editedTemplateFieldsRef = useRef<Set<TemplateDefaultField>>(new Set())
  const TAG_COLLAPSE_COUNT = 6

  useEffect(() => {
    if (!open) return
    void Promise.all([listVisualTemplates({ search: templateSearch, tagIds: selectedTagIds, allSegments }), listPickerTags()])
      .then(([page, tagList]) => { setTemplates(page.items); setTags(tagList) })
      .catch(() => { setTemplates([]); setTags([]) })
  }, [allSegments, open, selectedTagIds, templateSearch])

  if (categories !== previousCategories) {
    setPreviousCategories(categories)
    setCategoryOptions(categories)
  }
  if (units !== previousUnits) {
    setPreviousUnits(units)
    setUnitOptions(units)
  }

  const formSchema = useMemo(
    () =>
      createRentalResourceFormSchema({
        nameRequired: t("rentals.resources.validation.nameRequired"),
        unitRequired: t("rentals.resources.validation.unitRequired"),
        categoryRequired: t("rentals.resources.validation.categoryRequired"),
        familyRequired: t("rentals.resources.validation.familyRequired"),
        quantityMin: t("rentals.resources.validation.quantityMin"),
        capacityRange: t("resourceVisual.capacityRange"),
        queueOpeningTimeRequired: t(
          "rentals.resources.validation.queueOpeningTimeRequired",
        ),
        cancelCutoffRange: t("rentals.resources.validation.cancelCutoffRange"),
        horizonRange: t("rentals.resources.validation.horizonRange"),
      }),
    [t],
  )

  const form = useForm<RentalResourceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildRentalResourceFormValues(
      editing,
      units,
      categories,
      families,
    ),
  })

  useEffect(() => {
    if (!open) {
      return
    }

    form.reset(
      buildRentalResourceFormValues(editing, units, categories, families),
    )
    editedTemplateFieldsRef.current = new Set()
  }, [categories, editing, families, form, open, units])

  const sheetOpenKey = open ? (editing?.id ?? "__new__") : null
  const [trackedSheetOpenKey, setTrackedSheetOpenKey] = useState<string | null>(null)
  if (sheetOpenKey !== trackedSheetOpenKey) {
    setTrackedSheetOpenKey(sheetOpenKey)
    if (sheetOpenKey !== null) {
      setSheetTab("basic")
      setTagsExpanded(false)
    }
  }

  const watched = useWatch({ control: form.control })
  const rentalType = watched.rentalType ?? "Location"
  const queueEnabled = watched.queueEnabled ?? false
  const cancelCutoffMode = watched.cancelCutoffMode ?? "inherit"
  const cancelCutoffItems = [
    { value: "inherit", label: t("rentals.resources.form.cancelCutoffInherit") },
    { value: "none", label: t("rentals.resources.form.cancelCutoffNone") },
    { value: "hours", label: t("rentals.resources.form.cancelCutoffHours") },
  ]
  const horizonMode: ResourceHorizonMode = watched.horizonMode ?? "inherit"
  const validation = formSchema.safeParse(watched)
  const isValid = validation.success
  const visibleErrors = useVisibleFormIssues(validation.success ? undefined : validation.error, form)
  const footerError = form.formState.errors.root?.message
    ?? visibleErrors?.issues.find((issue) => issue.path.length === 0)?.message
  const horizonItems = [
    { value: "inherit", label: t("rentals.resources.form.horizonInherit") },
    { value: "unlimited", label: t("rentals.resources.form.horizonUnlimited") },
    { value: "days", label: t("rentals.resources.form.horizonDaysMode") },
  ]
  const horizonEffectiveSourceKey =
    editing?.maxAdvanceBookingDays != null
      ? "rentals.resources.form.horizonEffectiveSourceResource"
      : "rentals.resources.form.horizonEffectiveSourcePolicy"

  const unitItems = unitOptions.map((unit) => ({ value: unit.id, label: unit.name }))
  const canCreateUnit = can("core.units.write") && !readOnly
  const canCreateCategory = !readOnly && can("rentals.assets.write")
  const canCreateGlobalTemplate = !readOnly && isPlatformAdmin
  const categoryItems = categoryOptions.map((category) => ({
    value: category.id,
    label: category.name,
  }))
  const familyItems = families.map((family) => ({
    value: family.id,
    label: family.label,
  }))
  const typeItems = [
    { value: "Location", label: t("rentals.resources.typeLocation") },
    { value: "Good", label: t("rentals.resources.typeGood") },
  ]
  const templateOptions = mergeTemplateOptions(
    templates,
    createdTemplateOptions,
    t("resourceVisual.noTemplate"),
  )

  async function refreshCategories() {
    const refreshed = await listRentalAssetCategories()
    setCategoryOptions(refreshed)
    return refreshed.map((category) => ({ value: category.id, label: category.name }))
  }

  async function refreshUnits() {
    const refreshed = await getUnits()
    setUnitOptions(refreshed)
    return refreshed.map((unit) => ({ value: unit.id, label: unit.name }))
  }

  async function refreshTemplates() {
    const refreshed = await listVisualTemplates({
      search: templateSearch,
      tagIds: selectedTagIds,
      allSegments,
    })
    setTemplates(refreshed.items)
    return mergeTemplateOptions(
      refreshed.items,
      createdTemplateOptions,
      t("resourceVisual.noTemplate"),
    )
  }

  function markTemplateFieldEdited(field: TemplateDefaultField) {
    editedTemplateFieldsRef.current.add(field)
  }

  function applyTemplateDefaults(revisionId: string) {
    const template = templates.find(
      (candidate) => candidate.publishedRevision?.id === revisionId,
    )
    const defaults = getTemplateRevisionFormDefaults(
      template?.publishedRevision,
      editedTemplateFieldsRef.current,
    )
    if (defaults.capacityPeople !== undefined) {
      form.setValue("capacityPeople", defaults.capacityPeople, { shouldDirty: false })
    }
    if (defaults.requiresDeposit !== undefined) {
      form.setValue("requiresDeposit", defaults.requiresDeposit, { shouldDirty: false })
    }
    if (defaults.horizonMode !== undefined && defaults.horizonDays !== undefined) {
      form.setValue("horizonMode", defaults.horizonMode, { shouldDirty: false })
      form.setValue("horizonDays", defaults.horizonDays, { shouldDirty: false })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="rental-resource-sheet"
      >
        <SheetHeader>
          <SheetTitle>
            {editing
              ? t("rentals.resources.edit")
              : t("rentals.resources.add")}
          </SheetTitle>
          <SheetDescription>
            {t("rentals.resources.formDescription")}
          </SheetDescription>
          {editing ? <RentalResourceDetails asset={editing} pricePerHour={pricePerHour} pricingUnit={pricingUnit} /> : null}
        </SheetHeader>

        <Form {...form}>
          <form
            className="resource-editor-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (readOnly) {
                return
              }
              void form.handleSubmit(async (values) => {
                // Template defaults are already shown above, so submit precisely these form values.
                const ok = await onSubmit(values)
                if (ok) {
                  onOpenChange(false)
                }
              }, (errors) => {
                const fields = Object.keys(errors)
                const inBasic = fields.some(
                  (name) =>
                    !SHEET_BASIC_FIELDS_EXCLUDED.pricing.has(name) &&
                    !SHEET_BASIC_FIELDS_EXCLUDED.visual.has(name),
                )
                setSheetTab(
                  inBasic
                    ? "basic"
                    : fields.some((name) => SHEET_BASIC_FIELDS_EXCLUDED.pricing.has(name))
                      ? "pricing"
                      : "visual",
                )
              })(event)
            }}
          >
            <Tabs
              value={sheetTab}
              onValueChange={(value) => {
                if (value === "basic" || value === "pricing" || value === "visual") {
                  setSheetTab(value)
                }
              }}
              className="resource-editor-tabs min-w-0 flex-col"
            >
              <TabsList className="resource-editor-tab-list min-w-0 overflow-x-auto">
                <TabsTrigger value="basic" className="shrink-0 whitespace-nowrap px-1.5 py-1.5 text-xs sm:text-sm">{t("rentals.resources.sheetTabs.basic")}</TabsTrigger>
                <TabsTrigger value="pricing" className="shrink-0 whitespace-nowrap px-1.5 py-1.5 text-xs sm:text-sm">{t("rentals.resources.sheetTabs.pricingRules")}</TabsTrigger>
                <TabsTrigger value="visual" className="shrink-0 whitespace-nowrap px-1.5 py-1.5 text-xs sm:text-sm">{t("rentals.resources.sheetTabs.visual")}</TabsTrigger>
              </TabsList>

            <TabsContent value="basic" className="min-w-0 flex-1 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.name")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      disabled={readOnly}
                      placeholder={t("rentals.resources.form.namePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <LiveFieldMessage message={issueMessageAt(visibleErrors, ["name"])} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.tag")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      disabled={readOnly}
                      placeholder={t("rentals.resources.form.tagPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="resource-editor-dependencies">
            {unitOptions.length !== 1 || canCreateUnit ? (
              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <FormItem onBlur={field.onBlur}>
                    <FormLabel>{t("rentals.resources.form.unit")}</FormLabel>
                    {canCreateUnit ? (
                      <FormControl>
                        <InlineCreateSelect
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            field.onBlur()
                          }}
                          options={unitItems}
                          onRefreshOptions={refreshUnits}
                          placeholder={t("rentals.resources.form.unitPlaceholder")}
                          createLabel={t("rentals.resources.inlineCreate.unitAction")}
                          drawerTitle={t("rentals.resources.inlineCreate.unitTitle")}
                          drawerDescription={t("rentals.resources.inlineCreate.unitDescription")}
                          disabled={readOnly}
                          renderCreateForm={({ complete, close }) => (
                            <InlineCreateUnitForm complete={complete} close={close} />
                          )}
                        />
                      </FormControl>
                    ) : (
                      <Select
                        modal={false}
                        onValueChange={(value) => {
                          field.onChange(value)
                          field.onBlur()
                        }}
                        value={field.value}
                        items={unitItems}
                        disabled={readOnly}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("rentals.resources.form.unitPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {unitOptions.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <LiveFieldMessage message={issueMessageAt(visibleErrors, ["unitId"])} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem onBlur={field.onBlur}>
                  <FormLabel>{t("rentals.resources.form.category")}</FormLabel>
                  <FormControl>
                    <InlineCreateSelect
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        field.onBlur()
                      }}
                      options={categoryItems}
                      onRefreshOptions={refreshCategories}
                      placeholder={t("rentals.resources.form.categoryPlaceholder")}
                      createLabel={t("rentals.resources.inlineCreate.categoryAction")}
                      drawerTitle={t("rentals.resources.inlineCreate.categoryTitle")}
                      drawerDescription={t("rentals.resources.inlineCreate.categoryDescription")}
                      disabled={readOnly}
                      canCreate={canCreateCategory}
                      renderCreateForm={({ complete, close }) => (
                        <InlineCreateCategoryForm complete={complete} close={close} />
                      )}
                    />
                  </FormControl>
                  <LiveFieldMessage message={issueMessageAt(visibleErrors, ["categoryId"])} />
                  <FormMessage />
                </FormItem>
              )}
            />

            </div>

            <FormField
              control={form.control}
              name="familyId"
              render={({ field }) => (
                <FormItem onBlur={field.onBlur}>
                  <FormLabel>{t("rentals.resources.form.family")}</FormLabel>
                  <Select
                    modal={false}
                    onValueChange={(value) => {
                      field.onChange(value)
                      field.onBlur()
                    }}
                    value={field.value}
                    items={familyItems}
                    disabled={readOnly || families.length === 1}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t(
                            "rentals.resources.form.familyPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {families.map((family) => (
                        <SelectItem key={family.id} value={family.id}>
                          {family.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <LiveFieldMessage message={issueMessageAt(visibleErrors, ["familyId"])} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rentalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.rentalType")}</FormLabel>
                  <FormControl>
                    <ResourceChoiceGroup
                      name={field.name}
                      label={t("rentals.resources.form.rentalType")}
                      value={field.value}
                      options={typeItems}
                      onChange={(value) => {
                        field.onChange(value)
                        field.onBlur()
                        if (value === "Good") {
                          form.setValue("queueEnabled", false)
                          form.setValue("queueOpeningTime", "")
                        } else {
                          form.setValue("totalQuantity", 1)
                        }
                      }}
                      onBlur={field.onBlur}
                      disabled={readOnly}
                      segmented
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {rentalType === "Good" ? (
              <FormField
                control={form.control}
                name="totalQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("rentals.resources.form.totalQuantity")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        disabled={readOnly}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(event) => {
                          field.onChange(Number(event.target.value) || 0)
                        }}
                      />
                    </FormControl>
                    <LiveFieldMessage message={issueMessageAt(visibleErrors, ["totalQuantity"])} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.location")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      disabled={readOnly}
                      placeholder={t(
                        "rentals.resources.form.locationPlaceholder",
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </TabsContent>

            <TabsContent value="pricing" className="min-w-0 flex-1 space-y-4">
            <FormField
              control={form.control}
              name="requiresDeposit"
              render={({ field }) => (
                <FormItem className="resource-editor-toggle flex flex-row items-center justify-between gap-3 border border-border">
                  <FormLabel className="m-0">
                    {t("rentals.resources.form.requiresDeposit")}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      disabled={readOnly}
                      onCheckedChange={(checked) => { markTemplateFieldEdited("requiresDeposit"); field.onChange(checked) }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {rentalType === "Location" ? (
              <>
                <FormField
                  control={form.control}
                  name="queueEnabled"
                  render={({ field }) => (
                    <FormItem className="resource-editor-toggle flex flex-row items-center justify-between gap-3 border border-border">
                      <FormLabel className="m-0">
                        {t("rentals.resources.form.queueEnabled")}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          disabled={readOnly}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {queueEnabled ? (
                  <FormField
                    control={form.control}
                    name="queueOpeningTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("rentals.resources.form.queueOpeningTime")}
                        </FormLabel>
                        <FormControl>
                          <Input type="time" disabled={readOnly} {...field} />
                        </FormControl>
                        <LiveFieldMessage message={issueMessageAt(visibleErrors, ["queueOpeningTime"])} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </>
            ) : null}

            <FormField
              control={form.control}
              name="horizonMode"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5"><FormLabel>{t("rentals.resources.form.horizonLabel")}</FormLabel><FieldHelp text={t("rentals.resources.form.horizonTechnicalHelp")} /></div>
                  <FormControl>
                    <ResourceChoiceGroup
                      name={field.name}
                      label={t("rentals.resources.form.horizonLabel")}
                      value={field.value}
                      options={horizonItems}
                      onChange={(value) => {
                        if (value === "inherit" || value === "unlimited" || value === "days") {
                          markTemplateFieldEdited("horizon")
                          field.onChange(value)
                          field.onBlur()
                        }
                      }}
                      onBlur={field.onBlur}
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("rentals.resources.form.horizonHint")}
                  </FormDescription>
                  {editing &&
                  editing.effectiveMaxAdvanceBookingDays !== undefined ? (
                    <p className="text-sm text-muted-foreground">
                      {editing.effectiveMaxAdvanceBookingDays === null
                        ? t(horizonEffectiveSourceKey, { context: "unlimited" })
                        : t(horizonEffectiveSourceKey, {
                            count: editing.effectiveMaxAdvanceBookingDays,
                          })}
                    </p>
                  ) : null}
                </FormItem>
              )}
            />

            {horizonMode === "days" ? (
              <FormField
                control={form.control}
                name="horizonDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("rentals.resources.form.horizonDays")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => { markTemplateFieldEdited("horizon"); field.onChange(event) }}
                        inputMode="numeric"
                        disabled={readOnly}
                        min={BOOKING_HORIZON_DAY_MIN}
                        max={BOOKING_HORIZON_DAY_MAX}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("rentals.resources.validation.horizonRange")}
                    </FormDescription>
                    <LiveFieldMessage message={issueMessageAt(visibleErrors, ["horizonDays"])} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="cancelCutoffMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.cancelCutoffLabel")}</FormLabel>
                  <FormControl>
                    <ResourceChoiceGroup
                      name={field.name}
                      label={t("rentals.resources.form.cancelCutoffLabel")}
                      value={cancelCutoffMode}
                      options={cancelCutoffItems}
                      onChange={(value) => {
                        if (value === "inherit" || value === "none" || value === "hours") {
                          field.onChange(value)
                          field.onBlur()
                        }
                      }}
                      onBlur={field.onBlur}
                      disabled={readOnly}
                    />
                  </FormControl>
                  {editing &&
                  editing.effectiveCancelCutoffHours !== undefined ? (
                    <p className="text-sm text-muted-foreground">
                      {editing.effectiveCancelCutoffHours === null
                        ? t(
                            "rentals.resources.form.cancelCutoffEffectiveNone",
                          )
                        : t("rentals.resources.form.cancelCutoffEffectiveHours", {
                            count: editing.effectiveCancelCutoffHours,
                          })}
                    </p>
                  ) : null}
                </FormItem>
              )}
            />

            {cancelCutoffMode === "hours" ? (
              <FormField
                control={form.control}
                name="cancelCutoffHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("rentals.resources.form.cancelCutoffHours")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="numeric"
                        disabled={readOnly}
                        min={0}
                        max={8760}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("rentals.resources.validation.cancelCutoffRange")}
                    </FormDescription>
                    <LiveFieldMessage message={issueMessageAt(visibleErrors, ["cancelCutoffHours"])} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            </TabsContent>

            <TabsContent value="visual" className="min-w-0 flex-1 space-y-2">
              <section className="resource-template-picker">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t("resourceVisual.pickerTitle")}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAllSegments((current) => !current)}>
                    {allSegments ? t("resourceVisual.useSegments") : t("resourceVisual.seeAll")}
                  </Button>
                </div>
                <label className="block text-sm font-medium" htmlFor="visual-template-search">{t("resourceVisual.searchTemplates")}</label>
                <Input id="visual-template-search" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder={t("resourceVisual.searchTemplates")} />
                <div className="flex flex-wrap items-center gap-1" aria-label={t("resourceVisual.filterByTag")}>
                  <span className="basis-full text-sm font-medium">{t("resourceVisual.filterByTag")}</span>
                  {(tagsExpanded ? tags : tags.slice(0, TAG_COLLAPSE_COUNT)).map((tag) => <Button key={tag.id} type="button" size="sm" variant={selectedTagIds.includes(tag.id) ? "default" : "outline"} aria-pressed={selectedTagIds.includes(tag.id)} onClick={() => setSelectedTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])}>{tag.nameI18n["pt-BR"] ?? tag.slug}</Button>)}
                  {tags.length > TAG_COLLAPSE_COUNT ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setTagsExpanded((current) => !current)}>
                      {tagsExpanded
                        ? t("resourceVisual.showFewerTags")
                        : t("resourceVisual.showMoreTags", { count: tags.length - TAG_COLLAPSE_COUNT })}
                    </Button>
                  ) : null}
                </div>
                <FormField control={form.control} name="visualTemplateRevisionId" render={({ field }) => {
                  const selectTemplate = (value: string) => {
                    const revisionId = value === "__no-template__" ? "" : value
                    field.onChange(revisionId)
                    field.onBlur()
                    applyTemplateDefaults(revisionId)
                  }
                  return (
                    <FormItem>
                      <FormLabel className="sr-only">{t("resourceVisual.pickerTitle")}</FormLabel>
                      <FormControl>
                        <InlineCreateSelect
                          value={field.value || "__no-template__"}
                          onValueChange={selectTemplate}
                          options={templateOptions}
                          onRefreshOptions={refreshTemplates}
                          placeholder={t("resourceVisual.noTemplate")}
                          createLabel={t("rentals.resources.inlineCreate.templateAction")}
                          drawerTitle={t("rentals.resources.inlineCreate.templateTitle")}
                          drawerDescription={t("rentals.resources.inlineCreate.templateDescription")}
                          disabled={readOnly}
                          canCreate={canCreateGlobalTemplate}
                          renderCreateForm={({ complete, close }) => (
                            <InlineCreateVisualTemplateForm complete={async (option) => {
                              setCreatedTemplateOptions((current) => [...current.filter((item) => item.value !== option.value), option])
                              await complete(option)
                            }} close={close} />
                          )}
                        />
                      </FormControl>
                      <div className="resource-template-grid" role="group" aria-label={t("resourceVisual.pickerTitle")}>
                        {templateOptions.map((option) => {
                          const noTemplate = option.value === "__no-template__"
                          const revision = templates.find((template) => template.publishedRevision?.id === option.value)?.publishedRevision
                          const Icon = noTemplate ? CircleX : (VISUAL_ICON_MAP[revision?.defaultIcon ?? ""] ?? LayoutTemplate)
                          return (
                            <button key={option.value} type="button" className="resource-template-card"
                              disabled={readOnly} aria-pressed={(field.value || "__no-template__") === option.value}
                              onClick={() => selectTemplate(option.value)}>
                              <span className="resource-template-art" aria-hidden="true"><Icon strokeWidth={ICON_STROKE_WIDTH} /></span>
                              <span>{option.label}</span>
                            </button>
                          )
                        })}
                      </div>
                      <LiveFieldMessage message={issueMessageAt(visibleErrors, ["visualTemplateRevisionId"])} />
                      <FormMessage />
                    </FormItem>
                  )
                }} />
                <FormField control={form.control} name="capacityPeople" render={({ field }) => <FormItem><FormLabel>{t("resourceVisual.capacityPeople")}</FormLabel><FormControl><Input type="number" min={1} max={RESOURCE_CAPACITY_PEOPLE_MAX} step={1} {...field} onBlur={field.onBlur} onChange={(event) => { markTemplateFieldEdited("capacityPeople"); field.onChange(event) }} disabled={readOnly} /></FormControl><LiveFieldMessage message={issueMessageAt(visibleErrors, ["capacityPeople"])} /><FormMessage /></FormItem>} />
                <FormField control={form.control} name="confirmVisualSuggestions" render={({ field }) => <FormItem><label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly}/>{t("resourceVisual.applySuggestions")}</label><FormDescription>{t("resourceVisual.applySuggestionsHelp")}</FormDescription><FormMessage /></FormItem>} />
              </section>
            </TabsContent>
            </Tabs>

            <SheetFooter className="resource-editor-footer">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                }}
              >
                {t("common.cancel")}
              </Button>
              <FormPrimaryButton
                type="submit"
                isValid={isValid}
                loading={busy}
                disabled={readOnly}
              >
                {editing
                  ? t("rentals.resources.saveEdit")
                  : t("rentals.resources.saveCreate")}
              </FormPrimaryButton>
              {footerError ? (
                <p className="basis-full text-sm text-destructive" role="alert">
                  {footerError}
                </p>
              ) : null}
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
