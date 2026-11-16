import { CivilDateInput } from "@/components/CivilDateInput"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDown, ArrowUp, Box, ClipboardList, ClipboardPen, Plus, Trash2, User } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { FormPage } from "@/components/layout/FormPage"
import { EmptyState } from "@/components/ui/empty-state"
import { FormGrid, FormRow, FormSection } from "@/components/ui/form-layout"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { MaintenancePlan } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { getPlans } from "@/features/pmoc/services/pmocService"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useOptionalPermissions } from "@/features/users/permissions/PermissionContext"
import type { TechnicianUser } from "@/features/users/schemas/userSchemas"
import { getTechnicians } from "@/features/users/services/usersService"
import {
  createWorkOrderFormSchema,
  type CreateWorkOrderFormValues,
  type WorkOrderRegistryAsset,
} from "@/features/workOrders/schemas/workOrderSchemas"
import {
  createWorkOrder,
  generateWorkOrderFromPlan,
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"
import { readApiValidation } from "@/features/rentals/lib/readApiValidation"

/** FormRow clones its child with an id; the Select trigger carries the id itself. */
function IdSink({ children }: { id?: string; children: ReactNode }) {
  return <>{children}</>
}

const UNASSIGNED_VALUE = "unassigned"
const FORM_ID = "create-work-order-form"

type ChecklistMode = "plan" | "adhoc"
type AdHocTask = { key: number; title: string; isMandatory: boolean }

function orderedPlanTasks(plan: MaintenancePlan) {
  return [...plan.tasks].sort((a, b) => a.order - b.order)
}

export function CreateWorkOrderPage({ maintenance = false, sourcePlan }: { maintenance?: boolean; sourcePlan?: MaintenancePlan }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const permissions = useOptionalPermissions()
  const canReadPlans = permissions === null || permissions.can("pmoc.plans.read")
  const redirectTimeoutRef = useRef<number | null>(null)
  const [assets, setAssets] = useState<WorkOrderRegistryAsset[]>([])
  const [technicians, setTechnicians] = useState<TechnicianUser[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>(sourcePlan ? [sourcePlan] : [])
  const [mode, setMode] = useState<ChecklistMode>(sourcePlan ? "plan" : "adhoc")
  const [planId, setPlanId] = useState<string>(sourcePlan?.id ?? "")
  const [adHocTasks, setAdHocTasks] = useState<AdHocTask[]>([
    { key: 1, title: "", isMandatory: true },
  ])
  const [isLoadingLookups, setIsLoadingLookups] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)

  const formSchema = useMemo(
    () =>
      createWorkOrderFormSchema({
        assetRequired: t("workOrders.create.validation.assetRequired"),
        dateRequired: t("workOrders.create.validation.dateRequired"),
        dateInvalid: t("common.datePicker.invalid"),
      }),
    [t],
  )

  const form = useForm<CreateWorkOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assetId: "",
      assignedUserId: undefined,
      scheduledDate: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  })

  const assetId = useWatch({ control: form.control, name: "assetId" })

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true)
    setLoadError(null)

    try {
      const [assetData, technicianData] = await Promise.all([
        listWorkOrderAssets(),
        getTechnicians(),
      ])
      setAssets(assetData)
      setTechnicians(technicianData)
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("workOrders.create.errors.loadLookupsFailed"),
      )
    } finally {
      setIsLoadingLookups(false)
    }
  }, [t])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  // Plans feed the "use a plan checklist" mode; a failure just leaves ad hoc mode.
  useEffect(() => {
    // A prefilled plan (?plano=) is already loaded by the route; no need for the list.
    if (sourcePlan || !canReadPlans) return
    let cancelled = false
    void getPlans()
      .then((data) => {
        if (!cancelled) setPlans(data.filter((plan) => plan.isActive))
      })
      .catch(() => {
        if (!cancelled) setPlans([])
      })
    return () => {
      cancelled = true
    }
  }, [sourcePlan, canReadPlans])

  useEffect(
    () => () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    },
    [],
  )

  const selectedPlan = useMemo(
    () => (mode === "plan" ? plans.find((plan) => plan.id === planId) ?? null : null),
    [mode, planId, plans],
  )

  const visibleAssets = useMemo(() => {
    if (!selectedPlan) return assets
    return assets.filter(
      (asset) =>
        asset.unitId === selectedPlan.unitId &&
        (!selectedPlan.assetCategoryId || asset.categoryId === selectedPlan.assetCategoryId) &&
        (!selectedPlan.assetId || asset.id === selectedPlan.assetId) &&
        asset.status === "Active" &&
        !asset.scheduledDeletionAt?.trim(),
    )
  }, [assets, selectedPlan])

  const assetItems = useMemo(
    () =>
      visibleAssets.map((asset) => ({
        value: asset.id,
        label: `${asset.tag} — ${asset.name}`,
      })),
    [visibleAssets],
  )

  const technicianItems = useMemo(
    () => [
      {
        value: UNASSIGNED_VALUE,
        label: t("workOrders.create.form.unassigned"),
      },
      ...technicians.map((technician) => ({
        value: technician.id,
        label: technician.fullName,
      })),
    ],
    [t, technicians],
  )

  const planItems = useMemo(
    () => plans.map((plan) => ({ value: plan.id, label: plan.name })),
    [plans],
  )

  const modeOptions: readonly SegmentedControlOption<ChecklistMode>[] = [
    { value: "plan", label: t("workOrders.create.mode.plan") },
    { value: "adhoc", label: t("workOrders.create.mode.adhoc") },
  ]

  useEffect(() => {
    if (assetId && !visibleAssets.some((asset) => asset.id === assetId)) {
      form.setValue("assetId", "", { shouldDirty: true })
    }
  }, [assetId, visibleAssets, form])

  function taskIssues(): string[] {
    if (mode === "plan") {
      if (!selectedPlan) return [t("workOrders.create.validation.planRequired")]
      if (selectedPlan.tasks.length === 0) return [t("workOrders.create.plan.noTasks")]
      return []
    }
    return adHocTasks.some((task) => task.title.trim() !== "")
      ? []
      : [t("workOrders.create.validation.taskRequired")]
  }

  function buildAdHocTasks() {
    return adHocTasks
      .filter((task) => task.title.trim() !== "")
      .map((task, index) => ({
        planTaskId: null,
        title: task.title.trim(),
        inputType: "Text" as const,
        isMandatory: task.isMandatory,
        order: index + 1,
        configuration: null,
      }))
  }

  async function onSubmit(values: CreateWorkOrderFormValues) {
    setSubmitError(null)
    const issues = taskIssues()
    setMissing(issues)
    if (issues.length > 0) return

    try {
      // Plan mode keeps the dedicated endpoint: it builds the checklist (planTaskId) server-side
      // and applies the plan/asset duplicate guard that a plain create would skip.
      const created = selectedPlan
        ? await generateWorkOrderFromPlan({
            planId: selectedPlan.id,
            assetId: values.assetId,
            assignedUserId: values.assignedUserId ?? null,
            scheduledDate: values.scheduledDate,
          })
        : await createWorkOrder({
            assetId: values.assetId,
            maintenancePlanId: null,
            assignedUserId: values.assignedUserId ?? null,
            scheduledDate: values.scheduledDate,
            notes: values.notes.trim() || null,
            tasks: buildAdHocTasks(),
          })

      setIsSubmitted(true)
      toast.success(t("workOrders.create.success"))
      redirectTimeoutRef.current = window.setTimeout(() => {
        void navigate(`/os/${created.id}`)
      }, 4000)
    } catch (error: unknown) {
      const parsed = readApiValidation(error)
      const fields = parsed.fields
      for (const [name, message] of Object.entries(fields)) {
        if (name === "assetId" || name === "scheduledDate" || name === "notes") {
          form.setError(name, { message })
        }
      }
      const message =
        parsed.summary[0]
        ?? (error instanceof Error ? error.message : t("workOrders.create.errors.createFailed"))
      setSubmitError(message)
      toast.error(message)
    }
  }

  function onInvalid() {
    const parsed = formSchema.safeParse(form.getValues())
    const messages = [
      ...new Set([
        ...(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)),
        ...taskIssues(),
      ]),
    ]
    setMissing(messages)
    const first = parsed.success ? undefined : parsed.error.issues[0]?.path[0]
    if (typeof first === "string") {
      form.setFocus(first as keyof CreateWorkOrderFormValues)
    }
  }

  function updateAdHoc(key: number, patch: Partial<AdHocTask>) {
    setAdHocTasks((current) =>
      current.map((task) => (task.key === key ? { ...task, ...patch } : task)),
    )
  }

  function moveAdHoc(index: number, delta: -1 | 1) {
    setAdHocTasks((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved as AdHocTask)
      return next
    })
  }

  const showModeChoice = plans.length > 0 || sourcePlan !== undefined
  const locked = isLoadingLookups || isSubmitted
  const allAssetsEmpty = !isLoadingLookups && assets.length === 0 && !loadError

  return (
    <FormPage
      header={{
        title: t(sourcePlan ? "maintenance.generate" : maintenance ? "maintenance.newOrder" : "workOrders.create.title"),
        description: t(sourcePlan ? "maintenance.generateDescription" : "workOrders.create.description"),
      }}
      dirty={form.formState.isDirty && !isSubmitted}
      guardUnsaved={!isSubmitted}
      saveRequiresDirty={false}
      saving={form.formState.isSubmitting}
      saveDisabled={locked || allAssetsEmpty}
      saveLabel={isSubmitted ? t("workOrders.create.redirecting") : t("workOrders.create.submit")}
      discardLabel={t("common.cancel")}
      onDiscard={
        maintenance
          ? () => {
              void navigate("/manutencao?aba=ordens")
            }
          : undefined
      }
      submitFormId={FORM_ID}
    >
      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {submitError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {submitError}
        </div>
      ) : null}

      {allAssetsEmpty ? (
        <div role="status">
          <EmptyState
            icon={ClipboardPen}
            title={t("workOrders.create.emptyAssetsTitle")}
            description={t("workOrders.create.emptyAssetsDescription")}
          />
        </div>
      ) : (
        <Form {...form}>
          <form
            id={FORM_ID}
            className="min-w-0 space-y-5"
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          >
            <FormSection title={t("workOrders.create.checklist.title")}>
              {showModeChoice ? (
                <SegmentedControl
                  label={t("workOrders.create.mode.label")}
                  value={mode}
                  options={modeOptions}
                  disabled={isSubmitted}
                  onChange={(next) => {
                    setMode(next)
                    setMissing([])
                  }}
                />
              ) : null}

              {mode === "plan" ? (
                <div className="space-y-4">
                  <FormRow
                    label={t("workOrders.create.plan.label")}
                    htmlFor="work-order-plan"
                    hint={t("workOrders.create.plan.hint")}
                  >
                    <IdSink>
                      <Select
                        modal={false}
                        value={planId}
                        onValueChange={(value) => {
                          setPlanId(value ?? "")
                          setMissing([])
                        }}
                        items={planItems}
                        disabled={isSubmitted}
                      >
                        <SelectTrigger icon={ClipboardList} id="work-order-plan" className="w-full">
                          <SelectValue placeholder={t("workOrders.create.plan.placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </IdSink>
                  </FormRow>
                  {selectedPlan ? (
                    <ol className="space-y-2 text-sm">
                      {orderedPlanTasks(selectedPlan).map((task, index) => (
                        <li
                          key={task.id}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                        >
                          <span className="flex min-w-0 gap-1.5">
                            <span className="tabular-nums">{index + 1}.</span>
                            <span className="min-w-0 break-words">{task.title}</span>
                          </span>
                          {task.isMandatory ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {t("workOrders.create.checklist.mandatory")}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <ul className="space-y-3">
                    {adHocTasks.map((task, index) => (
                      <li key={task.key} className="flex min-w-0 flex-wrap items-center gap-2">
                        <Input
                          className="min-w-0 flex-1 basis-48"
                          aria-label={t("workOrders.create.checklist.taskN", { n: index + 1 })}
                          placeholder={t("workOrders.create.checklist.taskPlaceholder")}
                          value={task.title}
                          disabled={isSubmitted}
                          onChange={(event) => {
                            updateAdHoc(task.key, { title: event.target.value })
                          }}
                        />
                        <Label className="touch-target inline-flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={task.isMandatory}
                            disabled={isSubmitted}
                            onChange={(event) => {
                              updateAdHoc(task.key, { isMandatory: event.target.checked })
                            }}
                          />
                          {t("workOrders.create.checklist.mandatory")}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="touch-target"
                          aria-label={t("workOrders.create.checklist.moveUp", { n: index + 1 })}
                          disabled={isSubmitted || index === 0}
                          onClick={() => {
                            moveAdHoc(index, -1)
                          }}
                        >
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="touch-target"
                          aria-label={t("workOrders.create.checklist.moveDown", { n: index + 1 })}
                          disabled={isSubmitted || index === adHocTasks.length - 1}
                          onClick={() => {
                            moveAdHoc(index, 1)
                          }}
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="touch-target"
                          aria-label={t("workOrders.create.checklist.remove", { n: index + 1 })}
                          disabled={isSubmitted || adHocTasks.length === 1}
                          onClick={() => {
                            setAdHocTasks((current) => current.filter((item) => item.key !== task.key))
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="outline"
                    className="touch-target"
                    disabled={isSubmitted}
                    onClick={() => {
                      setAdHocTasks((current) => [
                        ...current,
                        { key: Math.max(0, ...current.map((item) => item.key)) + 1, title: "", isMandatory: true },
                      ])
                    }}
                  >
                    <Plus data-icon="inline-start" />
                    {t("workOrders.create.checklist.add")}
                  </Button>
                </div>
              )}
            </FormSection>

            <FormSection title={t("workOrders.create.sections.details")}>
              <FormGrid columns={2}>
                <FormField
                  control={form.control}
                  name="assetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("workOrders.create.form.asset")}</FormLabel>
                      <Select
                        modal={false}
                        value={field.value}
                        onValueChange={field.onChange}
                        items={assetItems}
                        disabled={locked}
                      >
                        <FormControl>
                          <SelectTrigger icon={Box} className="w-full">
                            <SelectValue
                              placeholder={t(
                                "workOrders.create.form.assetPlaceholder",
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {visibleAssets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.tag} — {asset.name}
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
                  name="assignedUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("workOrders.create.form.technician")}
                      </FormLabel>
                      <Select
                        modal={false}
                        value={field.value ?? UNASSIGNED_VALUE}
                        onValueChange={(value) => {
                          field.onChange(
                            value === UNASSIGNED_VALUE ? undefined : value,
                          )
                        }}
                        items={technicianItems}
                        disabled={locked}
                      >
                        <FormControl>
                          <SelectTrigger icon={User} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_VALUE}>
                            {t("workOrders.create.form.unassigned")}
                          </SelectItem>
                          {technicians.map((technician) => (
                            <SelectItem
                              key={technician.id}
                              value={technician.id}
                            >
                              {technician.fullName}
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
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("workOrders.create.form.scheduledDate")}
                      </FormLabel>
                      <FormControl>
                        <CivilDateInput
                          className="tabular-nums motion-reduce:transition-none"
                          locale={i18n.resolvedLanguage ?? i18n.language}
                          disabled={isSubmitted}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormGrid>

              {!selectedPlan && <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("workOrders.create.form.notes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        className="touch-target min-w-0 motion-reduce:transition-none"
                        placeholder={t(
                          "workOrders.create.form.notesPlaceholder",
                        )}
                        disabled={isSubmitted}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />}
            </FormSection>

            {missing.length > 0 && submitError === null ? (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium">{t("assets.wizard.missingTitle")}</p>
                <ul className="mt-1 list-disc pl-5">
                  {missing.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}
          </form>
        </Form>
      )}
    </FormPage>
  )
}
