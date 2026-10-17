import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ClipboardList, LoaderCircle, Plus } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { isAxiosError } from "@/lib/api"

export function CreatePlanPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [isLoadingLookups, setIsLoadingLookups] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const formSchema = useMemo(
    () =>
      createPlanFormSchema({
        unitRequired: t("pmoc.create.validation.unitRequired"),
        nameRequired: t("pmoc.create.validation.nameRequired"),
        intervalInvalid: t("pmoc.scheduling.intervalInvalid"),
        firstDueRequired: t("pmoc.scheduling.firstDueRequired"),
        categoryRequired: t("pmoc.create.validation.categoryRequired"),
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
      assetCategoryId: "",
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
  const planError = parsedPlan.success ? undefined : parsedPlan.error
  const isPlanValid = parsedPlan.success
  const planMessages = uniqueIssueMessages(planError)
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
      const [unitsData, categoriesData] = await Promise.all([
        getUnits(),
        listPlanAssetCategories(),
      ])
      setUnits(unitsData)
      setCategories(categoriesData)
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
    void loadLookups()
  }, [loadLookups])

  async function onSubmit(values: CreatePlanFormValues) {
    setSubmitError(null)

    try {
      const created = await createPlan(buildCreatePlanRequest(values))
      toast.success(t("pmoc.create.success.created"))
      void navigate(`/pmoc/${created.id}`)
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

  const statusItems = useMemo(
    () => [
      { value: "true", label: t("pmoc.plans.status.active") },
      { value: "false", label: t("pmoc.plans.status.inactive") },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pmoc.create.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("pmoc.create.description")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigate("/pmoc")
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("pmoc.create.actions.back")}
          </Button>
        </div>
      </div>

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
      ) : (
        <Form {...form}>
          <form
            className="space-y-8"
            noValidate
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event)
            }}
          >
            <section className="space-y-4 rounded-xl border border-border p-4 sm:p-6">
              <div className="space-y-1">
                <h2 className="text-lg font-medium">
                  {t("pmoc.create.sections.main")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("pmoc.create.sections.mainDescription")}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t("pmoc.create.form.name")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder={t("pmoc.create.form.namePlaceholder")}
                          {...field}
                        />
                        </FormControl>
                      <FormMessage />
                      <LiveFieldMessage message={issueMessageAt(planError, ["name"])} />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
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
                      <Select
                        modal={false}
                        onValueChange={field.onChange}
                        value={field.value}
                        items={unitItems}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t(
                                "pmoc.create.form.unitPlaceholder",
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <LiveFieldMessage
                        message={issueMessageAt(planError, ["unitId"])}
                      />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assetCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.category")}</FormLabel>
                      <Select
                        modal={false}
                        onValueChange={field.onChange}
                        value={field.value}
                        items={categoryItems}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t(
                                "pmoc.create.form.categoryPlaceholder",
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <LiveFieldMessage
                        message={issueMessageAt(planError, ["assetCategoryId"])}
                      />
                    </FormItem>
                  )}
                />

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
                      <Select
                        modal={false}
                        onValueChange={(value) => {
                          field.onChange(value === "true")
                        }}
                        value={field.value ? "true" : "false"}
                        items={statusItems}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">
                            {t("pmoc.plans.status.active")}
                          </SelectItem>
                          <SelectItem value="false">
                            {t("pmoc.plans.status.inactive")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-border p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-medium">
                    {t("pmoc.create.sections.tasks")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("pmoc.create.sections.tasksDescription")}
                  </p>
                </div>

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
              </div>

              <PlanTaskEditor
                control={form.control}
                fields={fields}
                watchedTasks={watchedTasks}
                setValue={form.setValue}
                onRemove={remove}
                issueMessage={(path) => issueMessageAt(planError, path)}
              />
            </section>

            <FormValidationSummary messages={planMessages} />

            {submitError !== null ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigate("/pmoc")
                }}
              >
                {t("common.cancel")}
              </Button>
              <FormPrimaryButton
                type="submit"
                isValid={isPlanValid}
                loading={form.formState.isSubmitting}
                loadingLabel={t("pmoc.create.actions.saving")}
              >
                {t("pmoc.create.actions.save")}
              </FormPrimaryButton>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}

