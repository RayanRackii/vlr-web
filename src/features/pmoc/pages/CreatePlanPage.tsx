import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClipboardList, LibraryBig, LoaderCircle, PencilLine } from "lucide-react"
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
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PlanCombobox } from "@/features/pmoc/components/PlanCombobox"
import { PlanDescriptionField } from "@/features/pmoc/components/PlanDescriptionField"
import { PlanSchedulingFields } from "@/features/pmoc/components/PlanSchedulingFields"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOptionalPermissions } from "@/features/users/permissions/PermissionContext"
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
import { cn } from "@/lib/utils"

export function CreatePlanPage({ maintenance = false }: { maintenance?: boolean }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const canUseLibrary = useOptionalPermissions()?.can("pmoc.templates.read") ?? false
  const [startedBlank, setStartedBlank] = useState(false)
  const showStartChoice = canUseLibrary && !startedBlank && searchParams.get("modo") !== "branco"

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
      intervalDays: 30,
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
      if (unitsData.length === 1 && unitsData[0]) {
        form.setValue("unitId", unitsData[0].id)
      }
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
  }, [session, t, form])

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

  const header = {
    eyebrow: maintenance ? t("maintenance.eyebrow") : undefined,
    title: t(maintenance ? "maintenance.newPlan" : "pmoc.create.title"),
  }
  const formReady = !isLoadingLookups && loadError === null && categories.length > 0
  const formId = "create-plan-form"
  const target = watchedValues.target === "asset" ? "asset" : "type"

  if (showStartChoice) {
    const choiceClass =
      "flex min-h-11 w-full flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    return (
      <Page width="form" header={header}>
        <section className={cn("space-y-4", maintenance && "maintenance-card p-[18px]")}>
          <h2 className="text-base font-semibold">{t("pmoc.newPlan.choose.title")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/pmoc/biblioteca" className={cn(choiceClass, "border-primary/60")}>
              <LibraryBig className="size-5 text-primary" aria-hidden="true" />
              <span className="font-medium">{t("pmoc.newPlan.choose.library.title")}</span>
              <span className="text-sm text-muted-foreground">
                {t("pmoc.newPlan.choose.library.description")}
              </span>
            </Link>
            <button
              type="button"
              className={choiceClass}
              onClick={() => {
                setStartedBlank(true)
              }}
            >
              <PencilLine className="size-5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{t("pmoc.newPlan.choose.blank.title")}</span>
              <span className="text-sm text-muted-foreground">
                {t("pmoc.newPlan.choose.blank.description")}
              </span>
            </button>
          </div>
        </section>
      </Page>
    )
  }

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
      saveRequiresDirty={false}
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
          <FormSection title={t("pmoc.create.sections.main")}>
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

              <PlanDescriptionField
                control={form.control}
                hasValue={(watchedValues.description ?? "").length > 0}
              />

              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pmoc.create.form.unit")}</FormLabel>
                    <Select
                      modal={false}
                      value={field.value}
                      items={unitItems}
                      onValueChange={(value) => {
                        field.onChange(value)
                        form.setValue("assetId", "")
                        field.onBlur()
                      }}
                    >
                      <FormControl>
                        <SelectTrigger ref={field.ref} className="min-h-11 w-full">
                          <SelectValue placeholder={t("pmoc.create.form.unitPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unitItems.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <LiveFieldMessage
                      message={issueMessageAt(planError, ["unitId"])}
                    />
                  </FormItem>
                )}
              />

              {target === "asset" ? (
                <FormField
                  control={form.control}
                  name="assetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.asset")}</FormLabel>
                      <FormControl>
                        <PlanCombobox
                          ref={field.ref}
                          items={assetItems}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder={t("pmoc.newPlan.form.assetPlaceholder")}
                          searchLabel={t("pmoc.newPlan.form.assetSearch")}
                          emptyLabel={t("pmoc.newPlan.form.assetNone")}
                        />
                      </FormControl>
                      <LiveFieldMessage message={issueMessageAt(planError, ["assetId"])} />
                      <p className="text-sm text-muted-foreground">{t("pmoc.newPlan.form.assetHelp")}</p>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-11 px-0"
                        onClick={() => {
                          form.setValue("target", "type")
                          form.setValue("assetId", "")
                        }}
                      >
                        {t("pmoc.newPlan.form.backToCategory")}
                      </Button>
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="assetCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.newPlan.form.appliesTo")}</FormLabel>
                      <FormControl>
                        <PlanCombobox
                          ref={field.ref}
                          items={categoryItems}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder={t("pmoc.create.form.categoryPlaceholder")}
                          searchLabel={t("pmoc.newPlan.form.categorySearch")}
                          emptyLabel={t("pmoc.newPlan.form.categoryNone")}
                        />
                      </FormControl>
                      <LiveFieldMessage
                        message={issueMessageAt(planError, ["assetCategoryId"])}
                      />
                      <p className="text-sm text-muted-foreground">{t("pmoc.newPlan.form.appliesHelp")}</p>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-11 px-0"
                        onClick={() => {
                          form.setValue("target", "asset")
                          form.setValue("assetCategoryId", "")
                        }}
                      >
                        {t("pmoc.newPlan.form.specificAsset")}
                      </Button>
                    </FormItem>
                  )}
                />
              )}

              <PlanSchedulingFields
                control={form.control}
                intervalMessage={issueMessageAt(planError, ["intervalDays"])}
                firstDueMessage={issueMessageAt(planError, ["firstDueDate"])}
              />
            </FormGrid>
          </FormSection>

          <FormSection title={t("pmoc.create.sections.tasks")}>
            <PlanTaskEditor
              control={form.control}
              fields={fields}
              watchedTasks={watchedTasks}
              setValue={form.setValue}
              onRemove={remove}
              onAdd={() => {
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
