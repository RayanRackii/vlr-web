import { CivilDateInput } from "@/components/CivilDateInput"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClipboardPen } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/PageHeader"
import { EmptyState } from "@/components/ui/empty-state"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import type { MaintenancePlan } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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

const UNASSIGNED_VALUE = "unassigned"

export function CreateWorkOrderPage({ maintenance = false, sourcePlan }: { maintenance?: boolean; sourcePlan?: MaintenancePlan }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const redirectTimeoutRef = useRef<number | null>(null)
  const [assets, setAssets] = useState<WorkOrderRegistryAsset[]>([])
  const [technicians, setTechnicians] = useState<TechnicianUser[]>([])
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
        taskRequired: t("workOrders.create.validation.taskRequired"),
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
      taskTitle: sourcePlan?.name ?? "",
    },
  })

  useWatch({ control: form.control })

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true)
    setLoadError(null)

    try {
      const [assetData, technicianData] = await Promise.all([
        listWorkOrderAssets(),
        getTechnicians(),
      ])
      setAssets(sourcePlan ? assetData.filter(asset => asset.unitId === sourcePlan.unitId && asset.categoryId === sourcePlan.assetCategoryId && asset.status === "Active" && !asset.scheduledDeletionAt?.trim()) : assetData)
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
  }, [t, sourcePlan])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(
    () => () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    },
    [],
  )

  const assetItems = useMemo(
    () =>
      assets.map((asset) => ({
        value: asset.id,
        label: `${asset.tag} — ${asset.name}`,
      })),
    [assets],
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

  async function onSubmit(values: CreateWorkOrderFormValues) {
    setSubmitError(null)
    setMissing([])

    try {
      const created = sourcePlan ? await generateWorkOrderFromPlan({
        planId: sourcePlan.id, assetId: values.assetId, assignedUserId: values.assignedUserId ?? null, scheduledDate: values.scheduledDate,
      }) : await createWorkOrder({
        assetId: values.assetId,
        maintenancePlanId: null,
        assignedUserId: values.assignedUserId ?? null,
        scheduledDate: values.scheduledDate,
        notes: values.notes.trim() || null,
        tasks: [
          {
            planTaskId: null,
            title: values.taskTitle,
            inputType: "Text",
            isMandatory: true,
            order: 1,
            configuration: null,
          },
        ],
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
        if (name === "assetId" || name === "scheduledDate" || name === "taskTitle" || name === "notes") {
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
    const messages = parsed.success ? [] : [...new Set(parsed.error.issues.map((issue) => issue.message))]
    setMissing(messages)
    const first = parsed.success ? undefined : parsed.error.issues[0]?.path[0]
    if (typeof first === "string") {
      form.setFocus(first as keyof CreateWorkOrderFormValues)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      {maintenance && <p className="maintenance-eyebrow">{t("maintenance.eyebrow")}</p>}
      <PageHeader
        title={t(sourcePlan ? "maintenance.generate" : maintenance ? "maintenance.newOrder" : "workOrders.create.title")}
        description={t(sourcePlan ? "maintenance.generateDescription" : "workOrders.create.description")}
      />
      {sourcePlan && <div className="space-y-2 text-sm"><p>{t("maintenance.sourcePlan", { name: sourcePlan.name })}</p><h2 className="font-semibold">{t("maintenance.checklist")}</h2><ol className="list-inside list-decimal">{sourcePlan.tasks.map(task => <li key={task.id}>{task.title}</li>)}</ol></div>}
      <Card className="min-w-0 motion-reduce:transition-none">
        <CardContent>
          {loadError ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {loadError}
            </div>
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {submitError}
            </div>
          ) : null}

          {!isLoadingLookups && assets.length === 0 && !loadError ? (
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
              className="min-w-0 space-y-5"
              onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            >
              <div className="grid min-w-0 gap-5 sm:grid-cols-2 [&>*]:min-w-0">
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
                        disabled={isLoadingLookups || isSubmitted}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t(
                                "workOrders.create.form.assetPlaceholder",
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assets.map((asset) => (
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
                        disabled={isLoadingLookups || isSubmitted}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
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

                {!sourcePlan && <FormField
                  control={form.control}
                  name="taskTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("workOrders.create.form.task")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            "workOrders.create.form.taskPlaceholder",
                          )}
                          disabled={isSubmitted}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />}
              </div>

              {!sourcePlan && <FormField
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

              {missing.length > 0 && submitError === null ? (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium">{t("assets.wizard.missingTitle")}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {missing.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3 justify-end border-t border-border pt-5 [&>button]:w-full sm:[&>button]:w-auto">
                {maintenance && <Button type="button" variant="ghost" onClick={() => { void navigate("/manutencao?aba=ordens") }}>{t("common.cancel")}</Button>}
                <FormPrimaryButton
                  type="submit"
                  isValid
                  loading={form.formState.isSubmitting}
                  disabled={isLoadingLookups || isSubmitted}
                >
                  {isSubmitted
                    ? t("workOrders.create.redirecting")
                    : t("workOrders.create.submit")}
                </FormPrimaryButton>
              </div>
            </form>
          </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
