import { useVisibleFormIssues } from "@/lib/useVisibleFormIssues"
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Plus } from "lucide-react"
import { useBreadcrumbTitle } from "@/components/layout/useBreadcrumbTitle"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  FormValidationSummary,
  LiveFieldMessage,
} from "@/features/pmoc/components/FormValidationSummary"
import { PlanTaskEditor } from "@/features/pmoc/components/PlanTaskEditor"
import { TaskConfigurationReadout } from "@/features/pmoc/components/TaskConfigurationReadout"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import { issueMessageAt, uniqueIssueMessages } from "@/features/pmoc/lib/formIssues"
import {
  buildHeaderUpdateFromPlan,
  buildReplaceTasksRequest,
  createPlanFormSchema,
  mapGlobalTemplateTaskToFormTask,
  type CreatePlanFormValues,
  type MaintenancePlan,
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
import { GenerateWorkOrderDialog } from "@/features/pmoc/components/GenerateWorkOrderDialog"
import { PlanCoverageSection } from "@/features/pmoc/components/PlanCoverageSection"
import { PlanRelatedWorkOrders } from "@/features/pmoc/components/PlanRelatedWorkOrders"
import { PlanSchedulingFields } from "@/features/pmoc/components/PlanSchedulingFields"
import { Can } from "@/features/users/permissions/Can"
import { useCan, usePermissions } from "@/features/users/permissions/PermissionContext"
import { formatCivilDateOnly } from "@/features/pmoc/lib/formatCivilDate"
import { isAxiosError } from "@/lib/api"

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
    intervalDays: plan.intervalDays,
    firstDueDate: plan.firstDueDate,
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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const params = useParams()
  const planId = params.id ?? ""
  const canWrite = useCan("pmoc.plans.write")
  const { activeModules } = usePermissions()
  const osModuleActive = activeModules.some(
    (module) => module.trim().toLowerCase() === "os",
  )

  const [plan, setPlan] = useState<MaintenancePlan | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  useBreadcrumbTitle(!isLoading && !loadError ? plan?.name : undefined)
  const [planInUse, setPlanInUse] = useState(false)
  const [isHeaderBusy, setIsHeaderBusy] = useState(false)
  const [isChecklistBusy, setIsChecklistBusy] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [relatedRefreshKey, setRelatedRefreshKey] = useState(0)

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
      assetCategoryId: "",
      isActive: true,
      tasks: [emptyTask()],
    },
  })

  const { reset, control } = form

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tasks",
  })

  const watchedTasks = useWatch({ control, name: "tasks" })
  const watchedValues = useWatch({ control })
  const parsedForm = formSchema.safeParse(watchedValues)
  const allFormErrors = parsedForm.success ? undefined : parsedForm.error
  const formError = useVisibleFormIssues(allFormErrors, form)
  const taskMessages = uniqueIssueMessages(
    allFormErrors,
    (path) => String(path[0] ?? "") === "tasks",
  )
  const headerMessages = uniqueIssueMessages(allFormErrors, (path) => {
    const head = String(path[0] ?? "")
    return (
      head === "name" ||
      head === "description" ||
      head === "intervalDays" ||
      head === "firstDueDate"
    )
  })
  const isChecklistValid = taskMessages.length === 0
  const headerDirty =
    plan !== null &&
    ((watchedValues.name ?? "").trim() !== plan.name ||
      (watchedValues.description ?? "").trim() !==
        (plan.description ?? "").trim() ||
      watchedValues.intervalDays !== plan.intervalDays ||
      (watchedValues.firstDueDate ?? "") !== plan.firstDueDate)

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
      setRelatedRefreshKey((current) => current + 1)
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

  async function onSaveHeader(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!plan || headerMessages.length > 0) {
      return
    }

    const values = form.getValues()
    const description = values.description?.trim() ?? ""

    setIsHeaderBusy(true)
    try {
      const next = await updatePlan(
        plan.id,
        buildHeaderUpdateFromPlan({
          ...plan,
          name: values.name.trim(),
          description: description.length > 0 ? description : null,
          intervalDays: values.intervalDays,
          firstDueDate: values.firstDueDate,
        }),
      )
      setPlan(next)
      reset(planToFormValues(next))
      toast.success(t("pmoc.plans.toast.updated"))
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

  async function onSaveChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!plan || taskMessages.length > 0) {
      return
    }

    setIsChecklistBusy(true)
    try {
      const next = await replaceTasks(
        plan.id,
        buildReplaceTasksRequest(form.getValues("tasks")),
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
    } finally {
      setIsChecklistBusy(false)
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
        setIsDeleteConfirmOpen(false)
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
          {!canWrite && plan.description ? (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={plan.isActive ? "success" : "secondary"}>
            {plan.isActive
              ? t("pmoc.plans.status.active")
              : t("pmoc.plans.status.inactive")}
          </Badge>
          {osModuleActive && plan.isActive ? (
            <Can permission="os.work_orders.create">
              <Button
                type="button"
                onClick={() => {
                  setIsGenerateOpen(true)
                }}
              >
                {t("pmoc.plans.actions.generateWorkOrder")}
              </Button>
            </Can>
          ) : null}
          {osModuleActive && !plan.isActive ? (
            <Can permission="os.work_orders.create">
              <p className="text-sm text-muted-foreground">
                {t("pmoc.plans.generate.inactivePlan")}
              </p>
            </Can>
          ) : null}
          <Can permission="pmoc.plans.write">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                setIsDeleteConfirmOpen(true)
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

      <section className="space-y-4 rounded-xl border border-border p-4 sm:p-6">
        <h2 className="text-sm font-medium">{t("pmoc.plans.sections.overview")}</h2>
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
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
        {canWrite ? (
          <Form {...form}>
            <form
              className="space-y-4"
              noValidate
              onSubmit={(event) => {
                void onSaveHeader(event)
              }}
            >
              <FormField
                control={control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pmoc.create.form.name")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <LiveFieldMessage
                      message={issueMessageAt(formError, ["name"])}
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pmoc.create.form.description")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <PlanSchedulingFields
                control={control}
                showEditHint
                intervalMessage={issueMessageAt(formError, ["intervalDays"])}
                firstDueMessage={issueMessageAt(formError, ["firstDueDate"])}
              />
              <Button
                type="submit"
                disabled={
                  isHeaderBusy || !headerDirty || headerMessages.length > 0
                }
              >
                {isHeaderBusy
                  ? t("pmoc.plans.actions.saving")
                  : t("pmoc.plans.actions.saveDetails")}
              </Button>
            </form>
          </Form>
        ) : (
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("pmoc.scheduling.interval")}
              </dt>
              <dd className="text-sm">
                {t("pmoc.scheduling.intervalValue", { days: plan.intervalDays })}
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("pmoc.scheduling.firstDue")}
              </dt>
              <dd className="text-sm" data-testid="plan-first-due-readonly">
                {formatCivilDateOnly(plan.firstDueDate, i18n.language)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-border p-4 sm:p-6">
        <h2 className="text-sm font-medium">{t("pmoc.plans.sections.origin")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">{t(`pmoc.plans.origin.${plan.originKind}`)}</p>
          {plan.originKind === "RolvixTemplate" &&
          plan.sourceTemplateVersion != null ? (
            <Badge variant="secondary">v{plan.sourceTemplateVersion}</Badge>
          ) : null}
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
                void onSaveChecklist(event)
              }}
              noValidate
            >
              <PlanTaskEditor
                control={control}
                fields={fields}
                watchedTasks={watchedTasks}
                setValue={form.setValue}
                onRemove={remove}
                issueMessage={(path) => issueMessageAt(formError, path)}
              />

              <FormValidationSummary messages={uniqueIssueMessages(formError, (path) => path.length === 1 && path[0] === "tasks")} />

              <div className="flex justify-end">
                <FormPrimaryButton
                  type="submit"
                  isValid={isChecklistValid}
                  loading={isChecklistBusy}
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
                    <TaskConfigurationReadout
                      inputType={task.inputType}
                      configuration={task.configuration}
                    />
                  </div>
                </li>
              ))}
          </ol>
        )}
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

      <PlanCoverageSection planId={plan.id} refreshKey={relatedRefreshKey} />

      {osModuleActive ? (
        <Can permission="os.work_orders.read">
          <PlanRelatedWorkOrders
            planId={plan.id}
            refreshKey={relatedRefreshKey}
            onGenerate={
              plan.isActive
                ? () => {
                    setIsGenerateOpen(true)
                  }
                : undefined
            }
          />
        </Can>
      ) : null}

      {osModuleActive ? (
        <Can permission="os.work_orders.create">
          <GenerateWorkOrderDialog
            open={isGenerateOpen}
            onOpenChange={setIsGenerateOpen}
            planId={plan.id}
            unitId={plan.unitId}
            assetCategoryId={plan.assetCategoryId}
            onGenerated={() => {
              setRelatedRefreshKey((current) => current + 1)
            }}
          />
        </Can>
      ) : null}

      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setIsDeleteConfirmOpen(open)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pmoc.plans.deleteConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pmoc.plans.deleteConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} />
            <Button
              type="button"
              variant="secondary"
              disabled={isHeaderBusy || isDeleting}
              onClick={() => {
                setIsDeleteConfirmOpen(false)
                void patchHeader({ isActive: false })
              }}
            >
              {t("pmoc.plans.actions.deactivate")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void onDelete()
              }}
            >
              {t("pmoc.plans.actions.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
