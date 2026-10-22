import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

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
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import {
  BOOKING_HORIZON_DAY_MAX,
  BOOKING_HORIZON_DAY_MIN,
} from "@/features/rentals/schemas/bookingPolicySchemas"
import { createRentalResourceFormSchema, type RegistryCategoryListItem, type RentalResourceFormValues, type ResourceHorizonMode } from "@/features/rentals/schemas/rentalResourceSchemas"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { listPickerTags, listVisualTemplates, type VisualTag, type VisualTemplate } from "@/features/rentals/services/resourceVisualService"
import { listRentalAssetCategories } from "@/features/rentals/services/rentalResourcesService"
import { InlineCreateCategoryForm, InlineCreateVisualTemplateForm } from "@/features/rentals/components/ResourceDependencyInlineCreateForms"
import { buildRentalResourceFormValues } from "@/features/rentals/components/rentalResourceFormDefaults"

type TemplateOption = { value: string; label: string }

export function mergeTemplateOptions(
  templates: readonly VisualTemplate[],
  createdOptions: readonly TemplateOption[],
  noTemplateLabel: string,
): TemplateOption[] {
  const options = [
    { value: "__no-template__", label: noTemplateLabel },
    ...templates.flatMap((template) =>
      template.publishedRevision
        ? [{
            value: template.publishedRevision.id,
            label: template.nameI18n["pt-BR"] ?? template.slug,
          }]
        : [],
    ),
    ...createdOptions,
  ]
  return [...new Map(options.map((option) => [option.value, option])).values()]
}

type RentalResourceSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: AdminRentalAsset | null
  units: readonly Unit[]
  categories: readonly RegistryCategoryListItem[]
  families: readonly AssetFamily[]
  busy: boolean
  readOnly: boolean
  onSubmit: (values: RentalResourceFormValues) => Promise<boolean>
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
  onSubmit,
}: RentalResourceSheetProps) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<VisualTemplate[]>([])
  const [categoryOptions, setCategoryOptions] = useState<readonly RegistryCategoryListItem[]>(categories)
  const [previousCategories, setPreviousCategories] = useState(categories)
  const [tags, setTags] = useState<VisualTag[]>([])
  const [createdTemplateOptions, setCreatedTemplateOptions] = useState<TemplateOption[]>([])
  const [templateSearch, setTemplateSearch] = useState("")
  const [allSegments, setAllSegments] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

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

  const formSchema = useMemo(
    () =>
      createRentalResourceFormSchema({
        nameRequired: t("rentals.resources.validation.nameRequired"),
        unitRequired: t("rentals.resources.validation.unitRequired"),
        categoryRequired: t("rentals.resources.validation.categoryRequired"),
        familyRequired: t("rentals.resources.validation.familyRequired"),
        quantityMin: t("rentals.resources.validation.quantityMin"),
        queueOpeningTimeRequired: t(
          "rentals.resources.validation.queueOpeningTimeRequired",
        ),
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
  }, [categories, editing, families, form, open, units])

  const watched = useWatch({ control: form.control })
  const rentalType = watched.rentalType ?? "Location"
  const queueEnabled = watched.queueEnabled ?? false
  const horizonMode: ResourceHorizonMode = watched.horizonMode ?? "inherit"
  const validation = formSchema.safeParse(watched)
  const isValid = validation.success
  const firstValidationError = validation.success
    ? null
    : validation.error.issues[0]?.message ?? null
  const horizonItems = [
    { value: "inherit", label: t("rentals.resources.form.horizonInherit") },
    { value: "unlimited", label: t("rentals.resources.form.horizonUnlimited") },
    { value: "days", label: t("rentals.resources.form.horizonDaysMode") },
  ]

  const unitItems = units.map((unit) => ({ value: unit.id, label: unit.name }))
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

  function applyTemplateDefaults(revisionId: string) {
    const template = templates.find(
      (candidate) => candidate.publishedRevision?.id === revisionId,
    )
    const suggestedCapacity = template?.publishedRevision?.suggestedCapacityPeople
    if (
      suggestedCapacity != null &&
      !form.getFieldState("capacityPeople").isDirty &&
      !form.getValues("capacityPeople").trim()
    ) {
      form.setValue("capacityPeople", String(suggestedCapacity), {
        shouldDirty: false,
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {editing
              ? t("rentals.resources.edit")
              : t("rentals.resources.add")}
          </SheetTitle>
          <SheetDescription>
            {t("rentals.resources.formDescription")}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (readOnly) {
                return
              }
              void form.handleSubmit(async (values) => {
                const ok = await onSubmit(values)
                if (ok) {
                  onOpenChange(false)
                }
              })(event)
            }}
          >
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

            {units.length !== 1 ? (
              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("rentals.resources.form.unit")}</FormLabel>
                    <Select
                      modal={false}
                      onValueChange={field.onChange}
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
                        {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.category")}</FormLabel>
                  <FormControl>
                    <InlineCreateSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      options={categoryItems}
                      onRefreshOptions={refreshCategories}
                      placeholder={t("rentals.resources.form.categoryPlaceholder")}
                      createLabel={t("rentals.resources.inlineCreate.categoryAction")}
                      drawerTitle={t("rentals.resources.inlineCreate.categoryTitle")}
                      drawerDescription={t("rentals.resources.inlineCreate.categoryDescription")}
                      disabled={readOnly}
                      renderCreateForm={({ complete, close }) => (
                        <InlineCreateCategoryForm complete={complete} close={close} />
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="familyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.family")}</FormLabel>
                  <Select
                    modal={false}
                    onValueChange={field.onChange}
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <section className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t("resourceVisual.pickerTitle")}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAllSegments((current) => !current)}>
                  {allSegments ? t("resourceVisual.useSegments") : t("resourceVisual.seeAll")}
                </Button>
              </div>
              <label className="block text-sm font-medium" htmlFor="visual-template-search">{t("resourceVisual.searchTemplates")}</label>
              <Input id="visual-template-search" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder={t("resourceVisual.searchTemplates")} />
              <div className="flex flex-wrap gap-1" aria-label={t("resourceVisual.filterByTag")}>
                <span className="basis-full text-sm font-medium">{t("resourceVisual.filterByTag")}</span>
                {tags.map((tag) => <Button key={tag.id} type="button" size="sm" variant={selectedTagIds.includes(tag.id) ? "default" : "outline"} aria-pressed={selectedTagIds.includes(tag.id)} onClick={() => setSelectedTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])}>{tag.nameI18n["pt-BR"] ?? tag.slug}</Button>)}
              </div>
              <FormField control={form.control} name="visualTemplateRevisionId" render={({ field }) => (
                <FormItem><FormLabel>{t("resourceVisual.pickerTitle")}</FormLabel><FormControl><InlineCreateSelect value={field.value || "__no-template__"} onValueChange={(value) => { const revisionId = value === "__no-template__" ? "" : value; field.onChange(revisionId); applyTemplateDefaults(revisionId) }} options={templateOptions} onRefreshOptions={refreshTemplates} placeholder={t("resourceVisual.noTemplate")} createLabel={t("rentals.resources.inlineCreate.templateAction")} drawerTitle={t("rentals.resources.inlineCreate.templateTitle")} drawerDescription={t("rentals.resources.inlineCreate.templateDescription")} disabled={readOnly} renderCreateForm={({ complete, close }) => <InlineCreateVisualTemplateForm complete={async (option) => { setCreatedTemplateOptions((current) => [...current.filter((item) => item.value !== option.value), option]); await complete(option) }} close={close} />} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="capacityPeople" render={({ field }) => <FormItem><FormLabel>{t("resourceVisual.capacityPeople")}</FormLabel><FormControl><Input type="number" min={1} value={field.value} onChange={field.onChange} disabled={readOnly} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="confirmVisualSuggestions" render={({ field }) => <FormItem><label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly}/>{t("resourceVisual.applySuggestions")}</label><FormDescription>{t("resourceVisual.applySuggestionsHelp")}</FormDescription><FormMessage /></FormItem>} />
            </section>

            <FormField
              control={form.control}
              name="rentalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.rentalType")}</FormLabel>
                  <Select
                    modal={false}
                    onValueChange={(value) => {
                      field.onChange(value)
                      if (value === "Good") {
                        form.setValue("queueEnabled", false)
                        form.setValue("queueOpeningTime", "")
                      } else {
                        form.setValue("totalQuantity", 1)
                      }
                    }}
                    value={field.value}
                    items={typeItems}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Location">
                        {t("rentals.resources.typeLocation")}
                      </SelectItem>
                      <SelectItem value="Good">
                        {t("rentals.resources.typeGood")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                        onChange={(event) => {
                          field.onChange(Number(event.target.value) || 0)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="requiresDeposit"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <FormLabel className="m-0">
                    {t("rentals.resources.form.requiresDeposit")}
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

            {rentalType === "Location" ? (
              <>
                <FormField
                  control={form.control}
                  name="queueEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
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
                  <Select
                    modal={false}
                    onValueChange={(value) => {
                      if (
                        value === "inherit" ||
                        value === "unlimited" ||
                        value === "days"
                      ) {
                        field.onChange(value)
                      }
                    }}
                    value={field.value}
                    items={horizonItems}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {horizonItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t("rentals.resources.form.horizonHint")}
                  </FormDescription>
                  {editing &&
                  editing.effectiveMaxAdvanceBookingDays !== undefined ? (
                    <p className="text-sm text-muted-foreground">
                      {editing.effectiveMaxAdvanceBookingDays === null
                        ? t(
                            "rentals.resources.form.horizonEffectiveUnlimited",
                          )
                        : t("rentals.resources.form.horizonEffectiveDays", {
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
                        inputMode="numeric"
                        disabled={readOnly}
                        min={BOOKING_HORIZON_DAY_MIN}
                        max={BOOKING_HORIZON_DAY_MAX}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("rentals.resources.validation.horizonRange")}
                    </FormDescription>
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

            <SheetFooter className="sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-popover px-4">
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
              {!isValid && firstValidationError ? (
                <p className="basis-full text-sm text-destructive" role="alert">
                  {firstValidationError}
                </p>
              ) : null}
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
