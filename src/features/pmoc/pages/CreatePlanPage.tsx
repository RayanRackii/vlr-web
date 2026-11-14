import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClipboardList, LoaderCircle, Plus } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FormPage } from "@/components/layout/FormPage"
import { Page } from "@/components/layout/Page"
import { FormGrid, FormSection } from "@/components/ui/form-layout"
import {
  FormValidationSummary,
  LiveFieldMessage,
} from "@/features/pmoc/components/FormValidationSummary"
import { PlanTaskEditor } from "@/features/pmoc/components/PlanTaskEditor"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Textarea } from "@/components/ui/textarea"
import { PlanSchedulingFields } from "@/features/pmoc/components/PlanSchedulingFields"
import { useAuth } from "@/contexts/AuthContext"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import type { RegistryCategoryListItem } from "@/features/pmoc/schemas/registryCategorySchemas"
import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"
import { issueMessageAt, uniqueIssueMessages } from "@/features/pmoc/lib/formIssues"
import {
  buildCreatePlanRequest,
  createPlanFormSchema,
  type CreatePlanFormValues,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { createPlan } from "@/features/pmoc/services/pmocService"
import { listWorkOrderAssets } from "@/features/workOrders/services/workOrdersService"
import type { WorkOrderRegistryAsset } from "@/features/workOrders/schemas/workOrderSchemas"
import { isAxiosError } from "@/lib/api"
import { useVisibleFormIssues } from "@/lib/useVisibleFormIssues"

export function CreatePlanPage({ maintenance = false }: { maintenance?: boolean }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [assets, setAssets] = useState<WorkOrderRegistryAsset[]>([])
  const [isLoadingLookups, setIsLoadingLookups] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const formSchema = useMemo(
    () =>
      createPlanFormSchema({
        unitRequired: t("pmoc.create.validation.unitRequired"),
        nameTooLong: t("common.validation.maxLength", { count: 200 }),
        nameRequired: t("pmoc.create.validation.nameRequired"),
        intervalInvalid: t("pmoc.scheduling.intervalInvalid"),
        firstDueRequired: t("pmoc.scheduling.firstDueRequired"),
        firstDueInvalid: t("common.datePicker.invalid"),
        categoryRequired: t("pmoc.create.validation.categoryRequired"),
        assetRequired: t("pmoc.create.validation.assetRequired"),
        taskTitleRequired: t("pmoc.create.validation.taskTitleRequired"),
        tasksRequired: t("pmoc.create.validation.tasksRequired"),
        numberMinRequired: t("pmoc.create.validation.numberMinRequired"),
        numberMaxRequired: t("pmoc.create.validation.numberMaxRequired"),
        numberRangeInvalid: t("pmoc.create.validation.numberRangeInvalid"),
        optionsRequired: t("pmoc.create.validation.optionsRequired"),
      }),
    [t],
  )

  const form = useForm<CreatePlanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitId: "",
      name: "",
      description: "",
      intervalDays: Number.NaN,
      firstDueDate: "",
      target: "type",
      assetCategoryId: "",
      assetId: "",
      isActive: true,
      tasks: [
        {
          title: "",
          inputType: "Checkbox",
          isMandatory: true,
          min: null,
          max: null,
          unit: null,
          options: undefined,
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tasks",
  })

  const watchedValues = useWatch({ control: form.control })
  const parsedPlan = formSchema.safeParse(watchedValues)
  const planError = useVisibleFormIssues(parsedPlan.success ? undefined : parsedPlan.error, form)
  const isPlanValid = parsedPlan.success
  // Field errors are shown inline; the summary only covers the checklist itself.
  const planMessages = uniqueIssueMessages(planError, (path) => path.length === 1 && path[0] === "tasks")
  const watchedTasks = watchedValues.tasks

  const loadLookups = useCallback(async () => {
    if (!session) {
      setLoadError(t("pmoc.create.errors.unauthorized"))
      setIsLoadingLookups(false)
      return
    }

    setIsLoadingLookups(true)
    setLoadError(null)

    try {
      const [unitsData, categoriesData, assetsData] = await Promise.all([
        getUnits(),
        listPlanAssetCategories(),
        listWorkOrderAssets(),
      ])
      setUnits(unitsData)
      setCategories(categoriesData)
      setAssets(assetsData)
    } catch (error: unknown) {
      console.error("CreatePlanPage loadLookups failed", error)
      if (isAxiosError(error)) {
        console.error("CreatePlanPage loadLookups response", error.response?.data)
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.create.errors.loadLookupsFailed")
      setLoadError(message)
    } finally {
      setIsLoadingLookups(false)
    }
  }, [session, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial and session-driven fetch; loadLookups owns the loading state
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    if (createdId !== null) void navigate(`/pmoc/${createdId}`)
  }, [createdId, navigate])

  async function onSubmit(values: CreatePlanFormValues) {
    setSubmitError(null)

    try {
      const created = await createPlan(buildCreatePlanRequest(values))
      toast.success(t("pmoc.create.success.created"))
      // Navigate from an effect so the unsaved-changes guard is already released.
      setCreatedId(created.id)
    } catch (error: unknown) {
      console.error("CreatePlanPage onSubmit failed", error)
      if (isAxiosError(error)) {
        console.error("CreatePlanPage onSubmit response", error.response?.data)
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.create.errors.createFailed")
      setSubmitError(message)
    }
  }

  const unitItems = useMemo(
    () =>
      units.map((unit) => ({
        value: unit.id,
        label: unit.name,
      })),
    [units],
  )

  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  )

  const assetItems = useMemo(
    () =>
      assets
        .filter((asset) => asset.unitId === watchedValues.unitId && asset.status === "Active" && !asset.scheduledDeletionAt)
        .map((asset) => ({
          value: asset.id,
          label: `${asset.tag} — ${asset.name}`,
        })),
    [assets, watchedValues.unitId],
  )

  const statusItems = useMemo(
    () => [
      { value: "true", label: t("pmoc.plans.status.active") },
      { value: "false", label: t("pmoc.plans.status.inactive") },
    ],
    [t],
  )

  const header = {
    eyebrow: maintenance ? t("maintenance.eyebrow") : undefined,
    title: t(maintenance ? "maintenance.newPlan" : "pmoc.create.title"),
    description: t("pmoc.create.description"),
  }
  const formReady = !isLoadingLookups && loadError === null && categories.length > 0
  const formId = "create-plan-form"

  if (!formReady) {
    return (
      <Page width="form" header={header}>
      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {isLoadingLookups ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          {t("pmoc.create.loading")}
        </div>
      ) : loadError !== null ? null : categories.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardList className="size-6" aria-hidden />
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t("pmoc.create.emptyCategoriesTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("pmoc.create.emptyCategoriesDescription")}
            </p>
          </div>
        </div>
      ) : null}
      </Page>
    )
  }

  return (
    <FormPage
      header={header}
      submitFormId={formId}
      dirty={form.formState.isDirty}
      saving={form.formState.isSubmitting}
      saveDisabled={!isPlanValid}
      saveLabel={t("pmoc.create.actions.save")}
      savingLabel={t("pmoc.create.actions.saving")}
      discardLabel={t("common.cancel")}
      guardUnsaved={createdId === null}
      onDiscard={() => {
        void navigate(maintenance ? "/manutencao?aba=planos" : "/pmoc")
      }}
    >
        <Form {...form}>
          <form
            id={formId}
            className={maintenance ? "maintenance-card space-y-8 p-[18px]" : "space-y-8"}
            noValidate
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing &&
                event.target instanceof HTMLInputElement &&
                !["button", "submit", "checkbox", "radio", "file"].includes(event.target.type)) {
                event.preventDefault()
                if (!form.formState.isSubmitting) event.currentTarget.requestSubmit()
              }
            }}
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event)
            }}
          >
            <FormSection
              title={t("pmoc.create.sections.main")}
              description={t("pmoc.create.sections.mainDescription")}
            >
              <FormGrid>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.name")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder={t("pmoc.create.form.namePlaceholder")}
                          {...field}
                        />
                        </FormControl>
                      <LiveFieldMessage message={issueMessageAt(planError, ["name"])} />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.description")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t(
                            "pmoc.create.form.descriptionPlaceholder",
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
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.unit")}</FormLabel>
                      <FormControl>
                        <div
                          role="radiogroup"
                          aria-label={t("pmoc.create.form.unit")}
                          ref={field.ref}
                          tabIndex={-1}
                          onBlur={field.onBlur}
                          className="flex flex-wrap gap-2 rounded-md aria-invalid:border-destructive"
                        >
                          {unitItems.map((unit) => (
                            <Button
                              key={unit.value}
                              type="button"
                              size="sm"
                              variant={field.value === unit.value ? "default" : "outline"}
                              aria-pressed={field.value === unit.value}
                              onClick={() => {
                                field.onChange(unit.value)
                                form.setValue("assetId", "")
                                field.onBlur()
                              }}
                            >
                              {unit.label}
                            </Button>
                          ))}
                        </div>
                      </FormControl>
                      <LiveFieldMessage
                        message={issueMessageAt(planError, ["unitId"])}
                      />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.target")}</FormLabel>
                      <FormControl>
                        <div role="radiogroup" aria-label={t("pmoc.create.form.target")} className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={field.value !== "asset" ? "default" : "outline"}
                            aria-pressed={field.value !== "asset"}
                            onClick={() => {
                              field.onChange("type")
                              form.setValue("assetId", "")
                            }}
                          >
                            {t("pmoc.create.form.targetType")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={field.value === "asset" ? "default" : "outline"}
                            aria-pressed={field.value === "asset"}
                            onClick={() => {
                              field.onChange("asset")
                              form.setValue("assetCategoryId", "")
                            }}
                          >
                            {t("pmoc.create.form.targetAsset")}
                          </Button>
                        </div>
                      </FormControl>
                      <p className="text-sm text-muted-foreground">{t("pmoc.create.form.targetHelp")}</p>
                    </FormItem>
                  )}
                />

                {watchedValues.target === "asset" ? (
                <FormField
                  control={form.control}
                  name="assetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.asset")}</FormLabel>
                      <FormControl>
                        <div
                          role="radiogroup"
                          aria-label={t("pmoc.create.form.asset")}
                          className="flex flex-wrap gap-2"
                        >
                          {assetItems.map((asset) => (
                            <Button
                              key={asset.value}
                              type="button"
                              size="sm"
                              variant={field.value === asset.value ? "default" : "outline"}
                              aria-pressed={field.value === asset.value}
                              onClick={() => {
                                field.onChange(asset.value)
                                field.onBlur()
                              }}
                            >
                              {asset.label}
                            </Button>
                          ))}
                        </div>
                      </FormControl>
                      <LiveFieldMessage message={issueMessageAt(planError, ["assetId"])} />
                    </FormItem>
                  )}
                />
                ) : (
                <FormField
                  control={form.control}
                  name="assetCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.category")}</FormLabel>
                      <FormControl>
                        <div
                          role="radiogroup"
                          aria-label={t("pmoc.create.form.category")}
                          ref={field.ref}
                          tabIndex={-1}
                          onBlur={field.onBlur}
                          className="flex flex-wrap gap-2 rounded-md aria-invalid:border-destructive"
                        >
                          {categoryItems.map((category) => (
                            <Button
                              key={category.value}
                              type="button"
                              size="sm"
                              variant={field.value === category.value ? "default" : "outline"}
                              aria-pressed={field.value === category.value}
                              onClick={() => {
                                field.onChange(category.value)
                                field.onBlur()
                              }}
                            >
                              {category.label}
                            </Button>
                          ))}
                        </div>
                      </FormControl>
                      <LiveFieldMessage
                        message={issueMessageAt(planError, ["assetCategoryId"])}
                      />
                    </FormItem>
                  )}
                />
                )}

                <PlanSchedulingFields
                  control={form.control}
                  intervalMessage={issueMessageAt(planError, ["intervalDays"])}
                  firstDueMessage={issueMessageAt(planError, ["firstDueDate"])}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.status")}</FormLabel>
                      <SegmentedControl
                        label={t("pmoc.create.form.status")}
                        value={field.value ? "true" : "false"}
                        onChange={(value) => {
                          field.onChange(value === "true")
                          field.onBlur()
                        }}
                        options={statusItems}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormGrid>
            </FormSection>

            <FormSection
              title={t("pmoc.create.sections.tasks")}
              description={t("pmoc.create.sections.tasksDescription")}
              actions={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    append({
                      title: "",
                      inputType: "Checkbox",
                      isMandatory: true,
                      min: null,
                      max: null,
                      unit: null,
                      options: undefined,
                    })
                  }}
                >
                  <Plus data-icon="inline-start" />
                  {t("pmoc.create.actions.addTask")}
                </Button>
              }
            >

              <PlanTaskEditor
                control={form.control}
                fields={fields}
                watchedTasks={watchedTasks}
                setValue={form.setValue}
                onRemove={remove}
                issueMessage={(path) => issueMessageAt(planError, path)}
              />
            </FormSection>

            <FormValidationSummary messages={planMessages} />

            {submitError !== null ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {submitError}
              </div>
            ) : null}
          </form>
        </Form>
    </FormPage>
  )
}

