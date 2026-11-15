import { useVisibleFormIssues } from "@/lib/useVisibleFormIssues"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { MoreHorizontal } from "lucide-react"
import { useBreadcrumbTitle } from "@/components/layout/useBreadcrumbTitle"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Page } from "@/components/layout/Page"
import { SaveBar } from "@/components/layout/SaveBar"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { FormSection } from "@/components/ui/form-layout"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status"
import {
  FormValidationSummary,
  LiveFieldMessage,
} from "@/features/pmoc/components/FormValidationSummary"
import { PlanDescriptionField } from "@/features/pmoc/components/PlanDescriptionField"
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
import { listWorkOrderAssets } from "@/features/workOrders/services/workOrdersService"
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
    target: plan.assetId ? "asset" : "type",
    assetCategoryId: plan.assetCategoryId ?? "",
    assetId: plan.assetId ?? "",
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
  const [assetLabel, setAssetLabel] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  useBreadcrumbTitle(!isLoading && !loadError ? plan?.name : undefined)
  const [planInUse, setPlanInUse] = useState(false)
  const [isHeaderBusy, setIsHeaderBusy] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
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
  const isFormValid = taskMessages.length === 0 && headerMessages.length === 0
  const headerDirty =
    plan !== null &&
    ((watchedValues.name ?? "").trim() !== plan.name ||
      (watchedValues.description ?? "").trim() !==
        (plan.description ?? "").trim() ||
      watchedValues.intervalDays !== plan.intervalDays ||
      (watchedValues.firstDueDate ?? "") !== plan.firstDueDate)
  const savedTasksKey = useMemo(
    () => (plan === null ? "" : JSON.stringify(planToFormValues(plan).tasks)),
    [plan],
  )
  const tasksDirty =
    plan !== null && JSON.stringify(watchedTasks ?? []) !== savedTasksKey
  const isDirty = headerDirty || tasksDirty

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
      if (planData.assetId) {
        const registry = await listWorkOrderAssets()
        const match = registry.find((asset) => asset.id === planData.assetId)
        setAssetLabel(match ? `${match.tag} — ${match.name}` : planData.assetId)
      } else {
        setAssetLabel(null)
      }
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

  useEffect(() => {
    // Navigate from an effect so the unsaved-changes guard is already released.
    if (isDeleted) void navigate("/manutencao?aba=planos")
  }, [isDeleted, navigate])

  const unitName = useMemo(() => {
    if (!plan) {
      return t("pmoc.plans.emptyValue")
    }
    return units.find((unit) => unit.id === plan.unitId)?.name ?? t("pmoc.plans.emptyValue")
  }, [plan, t, units])

  const categoryName = useMemo(() => {
    if (!plan) return t("pmoc.plans.emptyValue")
    if (plan.assetId) return assetLabel ?? plan.assetId
    return (
      categories.find((category) => category.id === plan.assetCategoryId)?.name ??
      t("pmoc.plans.emptyValue")
    )
  }, [assetLabel, categories, plan, t])

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

  /** One save for the plan data and the checklist: header first, then the tasks. */
  async function onSave() {
    if (!plan || isSaving || !isFormValid || !isDirty) {
      return
    }

    const values = form.getValues()
    const description = values.description?.trim() ?? ""
    let current = plan

    setIsSaving(true)
    try {
      if (headerDirty) {
        try {
          current = await updatePlan(
            plan.id,
            buildHeaderUpdateFromPlan({
              ...plan,
              name: values.name.trim(),
              description: description.length > 0 ? description : null,
              intervalDays: values.intervalDays,
              firstDueDate: values.firstDueDate,
            }),
          )
          setPlan(current)
        } catch (error: unknown) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("pmoc.plans.errors.updateFailed"),
          )
          return
        }
      }

      if (tasksDirty) {
        try {
          current = await replaceTasks(
            plan.id,
            buildReplaceTasksRequest(values.tasks),
          )
          setPlan(current)
        } catch (error: unknown) {
          const detail =
            error instanceof Error
              ? error.message
              : t("pmoc.plans.errors.replaceTasksFailed")
          // The header is already saved; the checklist edits stay in the form.
          toast.error(headerDirty ? t("pmoc.planDetail.errors.partialSave") : detail)
          return
        }
      }

      reset(planToFormValues(current))
      setRelatedRefreshKey((key) => key + 1)
      toast.success(t("pmoc.planDetail.toast.saved"))
    } finally {
      setIsSaving(false)
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
      setIsDeleted(true)
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

  const originLabel = `${t(`pmoc.planDetail.badges.origin.${plan.originKind}`)}${
    plan.originKind === "RolvixTemplate" && plan.sourceTemplateVersion != null
      ? ` v${plan.sourceTemplateVersion}`
      : ""
  }`

  const header = {
    title: plan.name,
    description: (
      <span className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={plan.isActive ? "success" : "neutral"}>
            {plan.isActive
              ? t("pmoc.plans.status.active")
              : t("pmoc.plans.status.inactive")}
          </StatusBadge>
          {plan.autoGenerateEnabled ? (
            <Badge variant="info">{t("pmoc.planDetail.badges.automatic")}</Badge>
          ) : null}
          <Badge variant="outline">{originLabel}</Badge>
          <span>
            {unitName} · {categoryName}
          </span>
        </span>
        {!canWrite && plan.description ? <span>{plan.description}</span> : null}
      </span>
    ),
    actions: (
      <>
        {osModuleActive && plan.isActive ? (
          <Can permission="os.work_orders.create">
            <Button
              type="button"
              className="min-h-11"
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={t("pmoc.planDetail.actions.more")}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem
                className="min-h-11 md:min-h-9"
                disabled={isHeaderBusy}
                onClick={() => {
                  void patchHeader({ isActive: !plan.isActive })
                }}
              >
                {plan.isActive
                  ? t("pmoc.plans.actions.deactivate")
                  : t("pmoc.planDetail.actions.activate")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11 md:min-h-9"
                disabled={isHeaderBusy}
                onClick={() => {
                  void patchHeader({ autoGenerateEnabled: !plan.autoGenerateEnabled })
                }}
              >
                {plan.autoGenerateEnabled
                  ? t("pmoc.planDetail.actions.disableAuto")
                  : t("pmoc.planDetail.actions.enableAuto")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11 text-destructive md:min-h-9"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleteConfirmOpen(true)
                }}
              >
                {t("pmoc.plans.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Can>
      </>
    ),
  }

  return (
    <Page header={header}>
      <UnsavedChangesGuard
        when={canWrite && isDirty && !isSaving && !isDeleted}
      />

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

      {canWrite ? (
        <Form {...form}>
          <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void onSave()
            }}
          >
            <FormSection title={t("pmoc.create.sections.main")}>
              <div className="grid gap-4">
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
                <PlanDescriptionField
                  control={control}
                  hasValue={(plan.description ?? "").length > 0}
                />
                <PlanSchedulingFields
                  control={control}
                  intervalMessage={issueMessageAt(formError, ["intervalDays"])}
                  firstDueMessage={issueMessageAt(formError, ["firstDueDate"])}
                />
              </div>
            </FormSection>

            <FormSection title={t("pmoc.plans.sections.checklist")}>
              <PlanTaskEditor
                control={control}
                fields={fields}
                watchedTasks={watchedTasks}
                setValue={form.setValue}
                onRemove={remove}
                onAdd={() => {
                  append(emptyTask())
                }}
                issueMessage={(path) => issueMessageAt(formError, path)}
              />
              <FormValidationSummary
                messages={uniqueIssueMessages(
                  formError,
                  (path) => path.length === 1 && path[0] === "tasks",
                )}
              />
            </FormSection>
          </form>
        </Form>
      ) : (
        <>
          <FormSection title={t("pmoc.create.sections.main")}>
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
          </FormSection>
          <FormSection title={t("pmoc.plans.sections.checklist")}>
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
                        {t(`pmoc.taskInputTypes.${task.inputType}`)}
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
          </FormSection>
        </>
      )}

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
            assetId={plan.assetId}
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

      {canWrite ? (
        <SaveBar
          dirty={isDirty}
          saving={isSaving}
          saveDisabled={!isFormValid}
          saveLabel={t("pmoc.planDetail.actions.save")}
          savingLabel={t("pmoc.plans.actions.saving")}
          discardLabel={t("common.cancel")}
          onDiscard={() => {
            reset(planToFormValues(plan))
          }}
          onSave={() => {
            void onSave()
          }}
        />
      ) : null}
    </Page>
  )
}
