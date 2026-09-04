import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import type { TechnicianUser } from "@/features/users/schemas/userSchemas"
import { getTechnicians } from "@/features/users/services/usersService"
import {
  createWorkOrderFormSchema,
  type CreateWorkOrderFormValues,
  type WorkOrderRegistryAsset,
} from "@/features/workOrders/schemas/workOrderSchemas"
import {
  createWorkOrder,
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"

const UNASSIGNED_VALUE = "unassigned"

export function CreateWorkOrderPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const redirectTimeoutRef = useRef<number | null>(null)
  const [assets, setAssets] = useState<WorkOrderRegistryAsset[]>([])
  const [technicians, setTechnicians] = useState<TechnicianUser[]>([])
  const [isLoadingLookups, setIsLoadingLookups] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const formSchema = useMemo(
    () =>
      createWorkOrderFormSchema({
        assetRequired: t("workOrders.create.validation.assetRequired"),
        dateRequired: t("workOrders.create.validation.dateRequired"),
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
      taskTitle: "",
    },
  })

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

    try {
      await createWorkOrder({
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
            order: 0,
            configuration: null,
          },
        ],
      })

      setIsSubmitted(true)
      toast.success(t("workOrders.create.success"))
      redirectTimeoutRef.current = window.setTimeout(() => {
        void navigate("/os")
      }, 4000)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("workOrders.create.errors.createFailed")
      setSubmitError(message)
      toast.error(message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          void navigate("/os")
        }}
      >
        <ArrowLeft data-icon="inline-start" />
        {t("common.back")}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("workOrders.create.title")}</CardTitle>
          <CardDescription>{t("workOrders.create.description")}</CardDescription>
        </CardHeader>
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
            <div
              role="status"
              className="rounded-lg border border-dashed border-border px-6 py-14 text-center"
            >
              <p className="text-sm font-medium">
                {t("workOrders.create.emptyAssetsTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("workOrders.create.emptyAssetsDescription")}
              </p>
            </div>
          ) : (
          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <div className="grid gap-5 sm:grid-cols-2">
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
                        <Input
                          type="date"
                          disabled={isSubmitted}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
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
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("workOrders.create.form.notes")}</FormLabel>
                    <FormControl>
                      <Textarea
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
              />

              <div className="flex justify-end">
                <LoadingButton
                  type="submit"
                  loading={form.formState.isSubmitting}
                  disabled={isLoadingLookups || isSubmitted}
                >
                  {isSubmitted
                    ? t("workOrders.create.redirecting")
                    : t("workOrders.create.submit")}
                </LoadingButton>
              </div>
            </form>
          </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
