import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import {
  buildHeaderUpdateFromPlan,
  buildReplaceTasksRequest,
  createPlanFormSchema,
  mapGlobalTemplateTaskToFormTask,
  taskInputTypeValues,
  type CreatePlanFormValues,
  type MaintenancePlan,
  type TaskInputType,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import type { RegistryCategoryListItem } from "@/features/pmoc/schemas/registryCategorySchemas"
import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"
import {
  deletePlan,
  getPlan,
  isPlanInUseError,
  replaceTasks,
  updatePlan,
} from "@/features/pmoc/services/pmocService"
import { Can } from "@/features/users/permissions/Can"
import { useCan } from "@/features/users/permissions/PermissionContext"
import { isAxiosError } from "@/lib/api"

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function emptyTask(): CreatePlanFormValues["tasks"][number] {
  return {
    title: "",
    inputType: "Checkbox",
    isMandatory: true,
    min: null,
    max: null,
    unit: null,
    options: undefined,
  }
}

function planToFormValues(plan: MaintenancePlan): CreatePlanFormValues {
  return {
    unitId: plan.unitId,
    name: plan.name,
    description: plan.description ?? "",
    frequency: plan.frequency,
    assetCategoryId: plan.assetCategoryId,
    isActive: plan.isActive,
    tasks:
      [...plan.tasks]
        .sort((left, right) => left.order - right.order)
        .map((task) => ({
          ...mapGlobalTemplateTaskToFormTask(task),
          taskId: task.id,
        })),
  }
}

export function PmocPlanDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams()
  const planId = params.id ?? ""
  const canWrite = useCan("pmoc.plans.write")

  const [plan, setPlan] = useState<MaintenancePlan | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [planInUse, setPlanInUse] = useState(false)
  const [isHeaderBusy, setIsHeaderBusy] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const formSchema = useMemo(
    () =>
      createPlanFormSchema({
        unitRequired: t("pmoc.create.validation.unitRequired"),
        nameRequired: t("pmoc.create.validation.nameRequired"),
        frequencyRequired: t("pmoc.create.validation.frequencyRequired"),
        categoryRequired: t("pmoc.create.validation.categoryRequired"),
        taskTitleRequired: t("pmoc.create.validation.taskTitleRequired"),
        tasksRequired: t("pmoc.create.validation.tasksRequired"),
        numberMinRequired: t("pmoc.create.validation.numberMinRequired"),
        numberMaxRequired: t("pmoc.create.validation.numberMaxRequired"),
        numberRangeInvalid: t("pmoc.create.validation.numberRangeInvalid"),
      }),
    [t],
  )

  const form = useForm<CreatePlanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitId: "",
      name: "",
      description: "",
      frequency: "Monthly",
      assetCategoryId: "",
      isActive: true,
      tasks: [emptyTask()],
    },
  })

  const { reset, control, handleSubmit, formState } = form

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tasks",
  })

  const watchedTasks = useWatch({ control, name: "tasks" })
  const watchedValues = useWatch({ control })
  const isChecklistValid = formSchema.safeParse(watchedValues).success

  const loadPage = useCallback(async () => {
    if (!planId) {
      setLoadError(t("pmoc.plans.errors.loadFailed"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const [planData, unitsData, categoriesData] = await Promise.all([
        getPlan(planId),
        getUnits(),
        listPlanAssetCategories(),
      ])
      setPlan(planData)
      setUnits(unitsData)
      setCategories(categoriesData)
      reset(planToFormValues(planData))
    } catch (error: unknown) {
      console.error("PmocPlanDetailPage loadPage failed", error)
      if (isAxiosError(error)) {
        console.error("PmocPlanDetailPage loadPage response", error.response?.data)
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.plans.errors.loadFailed")
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [planId, reset, t])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const unitName = useMemo(() => {
    if (!plan) {
      return t("pmoc.plans.emptyValue")
    }
    return units.find((unit) => unit.id === plan.unitId)?.name ?? t("pmoc.plans.emptyValue")
  }, [plan, t, units])

  const categoryName = useMemo(() => {
    if (!plan) {
      return t("pmoc.plans.emptyValue")
    }
    return (
      categories.find((category) => category.id === plan.assetCategoryId)?.name ??
      t("pmoc.plans.emptyValue")
    )
  }, [categories, plan, t])

  const inputTypeItems = useMemo(
    () =>
      taskInputTypeValues.map((inputType) => ({
        value: inputType,
        label: t(`pmoc.inputType.${inputType}`),
      })),
    [t],
  )

  async function patchHeader(
    patch: Partial<Pick<MaintenancePlan, "isActive" | "autoGenerateEnabled">>,
  ) {
    if (!plan) {
      return
    }

    setIsHeaderBusy(true)
    try {
      const next = await updatePlan(plan.id, buildHeaderUpdateFromPlan(plan, patch))
      setPlan(next)
      toast.success(
        patch.isActive === false
          ? t("pmoc.plans.toast.deactivated")
          : t("pmoc.plans.toast.updated"),
      )
      if (patch.isActive === false) {
        setPlanInUse(false)
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.plans.errors.updateFailed")
      toast.error(message)
    } finally {
      setIsHeaderBusy(false)
    }
  }

  async function onSaveChecklist(values: CreatePlanFormValues) {
    if (!plan) {
      return
    }

    try {
      const next = await replaceTasks(
        plan.id,
        buildReplaceTasksRequest(values.tasks),
      )
      setPlan(next)
      reset(planToFormValues(next))
      toast.success(t("pmoc.plans.toast.checklistSaved"))
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.plans.errors.replaceTasksFailed")
      toast.error(message)
    }
  }

  async function onDelete() {
    if (!plan) {
      return
    }

    setIsDeleting(true)
    try {
      await deletePlan(plan.id)
      toast.success(t("pmoc.plans.toast.deleted"))
      void navigate("/pmoc")
    } catch (error: unknown) {
      if (isPlanInUseError(error)) {
        setPlanInUse(true)
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.plans.errors.deleteFailed")
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <PageContentSkeleton rows={6} />
  }

  if (loadError !== null || plan === null) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError ?? t("pmoc.plans.errors.loadFailed")}
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadPage()}
          >
            {t("pmoc.create.actions.back")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigate("/pmoc")
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("pmoc.create.actions.back")}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{plan.name}</h1>
          {plan.description ? (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={plan.isActive ? "success" : "secondary"}>
            {plan.isActive
              ? t("pmoc.plans.status.active")
              : t("pmoc.plans.status.inactive")}
          </Badge>
          <Can permission="pmoc.plans.write">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                void onDelete()
              }}
            >
              {t("pmoc.plans.actions.delete")}
            </Button>
          </Can>
        </div>
      </div>

      {planInUse ? (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
        >
          <p className="text-destructive">{t("pmoc.plans.errors.planInUse")}</p>
          <Can permission="pmoc.plans.write">
            <Button
              type="button"
              variant="secondary"
              disabled={isHeaderBusy}
              onClick={() => {
                void patchHeader({ isActive: false })
              }}
            >
              {t("pmoc.plans.actions.deactivate")}
            </Button>
          </Can>
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border p-4 sm:p-6">
        <h2 className="text-sm font-medium">{t("pmoc.plans.sections.overview")}</h2>
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">
              {t("pmoc.create.form.frequency")}
            </dt>
            <dd className="text-sm">{t(`pmoc.frequency.${plan.frequency}`)}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">
              {t("pmoc.create.form.unit")}
            </dt>
            <dd className="text-sm">{unitName}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">
              {t("pmoc.create.form.category")}
            </dt>
            <dd className="text-sm">{categoryName}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2 rounded-xl border border-border p-4">
        <h2 className="text-sm font-medium">{t("pmoc.plans.sections.origin")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">{t(`pmoc.plans.origin.${plan.originKind}`)}</p>
          {plan.originKind === "RolvixTemplate" &&
          plan.sourceTemplateVersion != null ? (
            <Badge variant="secondary">v{plan.sourceTemplateVersion}</Badge>
          ) : null}
        </div>
      </section>

      <section className="divide-y rounded-xl border border-border">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium">{t("pmoc.plans.columns.status")}</h2>
            <p className="text-sm text-muted-foreground">
              {plan.isActive
                ? t("pmoc.plans.status.active")
                : t("pmoc.plans.status.inactive")}
            </p>
          </div>
          <Can permission="pmoc.plans.write">
            <Switch
              checked={plan.isActive}
              disabled={isHeaderBusy}
              aria-label={t("pmoc.plans.columns.status")}
              onCheckedChange={(checked) => {
                void patchHeader({ isActive: checked })
              }}
            />
          </Can>
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium">
              {t("pmoc.plans.autoGenerateEnabled")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {plan.autoGenerateEnabled
                ? t("pmoc.plans.autoGenerateOn")
                : t("pmoc.plans.autoGenerateOff")}
            </p>
          </div>
          <Can permission="pmoc.plans.write">
            <Switch
              checked={plan.autoGenerateEnabled}
              disabled={isHeaderBusy}
              aria-label={t("pmoc.plans.autoGenerateEnabled")}
              onCheckedChange={(checked) => {
                void patchHeader({ autoGenerateEnabled: checked })
              }}
            />
          </Can>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-medium">
            {t("pmoc.plans.sections.checklist")}
          </h2>
          <Can permission="pmoc.plans.write">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                append(emptyTask())
              }}
            >
              <Plus data-icon="inline-start" />
              {t("pmoc.create.actions.addTask")}
            </Button>
          </Can>
        </div>

        {canWrite ? (
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void handleSubmit(onSaveChecklist)(event)
              }}
              noValidate
            >
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const inputType =
                    (watchedTasks?.[index]?.inputType as TaskInputType | undefined) ??
                    field.inputType

                  return (
                    <div
                      key={field.id}
                      className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium">
                          {t("pmoc.create.tasks.itemTitle", {
                            number: index + 1,
                          })}
                        </h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={fields.length <= 1}
                          aria-label={t("pmoc.create.actions.removeTask")}
                          onClick={() => {
                            remove(index)
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name={`tasks.${index}.title`}
                        render={({ field: titleField }) => (
                          <FormItem>
                            <FormLabel>{t("pmoc.create.tasks.title")}</FormLabel>
                            <FormControl>
                              <Input
                                autoComplete="off"
                                placeholder={t(
                                  "pmoc.create.tasks.titlePlaceholder",
                                )}
                                {...titleField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.inputType`}
                          render={({ field: inputTypeField }) => (
                            <FormItem>
                              <FormLabel>
                                {t("pmoc.create.tasks.inputType")}
                              </FormLabel>
                              <Select
                                modal={false}
                                onValueChange={inputTypeField.onChange}
                                value={inputTypeField.value}
                                items={inputTypeItems}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {taskInputTypeValues.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {t(`pmoc.inputType.${type}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`tasks.${index}.isMandatory`}
                          render={({ field: mandatoryField }) => (
                            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                              <FormLabel className="m-0">
                                {t("pmoc.create.tasks.isMandatory")}
                              </FormLabel>
                              <FormControl>
                                <Switch
                                  checked={mandatoryField.value}
                                  onCheckedChange={mandatoryField.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {inputType === "Number" ? (
                          <>
                            <FormField
                              control={form.control}
                              name={`tasks.${index}.min`}
                              render={({ field: minField }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t("pmoc.create.tasks.min")}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      value={
                                        minField.value == null
                                          ? ""
                                          : String(minField.value)
                                      }
                                      onChange={(event) => {
                                        minField.onChange(
                                          parseOptionalNumber(
                                            event.target.value,
                                          ),
                                        )
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`tasks.${index}.max`}
                              render={({ field: maxField }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t("pmoc.create.tasks.max")}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      value={
                                        maxField.value == null
                                          ? ""
                                          : String(maxField.value)
                                      }
                                      onChange={(event) => {
                                        maxField.onChange(
                                          parseOptionalNumber(
                                            event.target.value,
                                          ),
                                        )
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end">
                <FormPrimaryButton
                  type="submit"
                  isValid={isChecklistValid}
                  loading={formState.isSubmitting}
                  loadingLabel={t("pmoc.plans.actions.saving")}
                >
                  {t("pmoc.plans.actions.saveChecklist")}
                </FormPrimaryButton>
              </div>
            </form>
          </Form>
        ) : (
          <ol className="divide-y rounded-lg border border-border">
            {[...plan.tasks]
              .sort((left, right) => left.order - right.order)
              .map((task, index) => (
                <li
                  key={task.id}
                  className="flex items-start gap-3 px-4 py-3 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums text-muted-foreground"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-muted-foreground">
                      {t(`pmoc.inputType.${task.inputType}`)}
                      {task.isMandatory
                        ? ` · ${t("pmoc.create.tasks.isMandatory")}`
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  )
}
