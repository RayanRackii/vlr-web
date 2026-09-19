import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import type { TechnicianUser } from "@/features/users/schemas/userSchemas"
import { getTechnicians } from "@/features/users/services/usersService"
import {
  generateWorkOrderFromPlanFormSchema,
  type GenerateWorkOrderFromPlanFormValues,
  type WorkOrder,
  type WorkOrderRegistryAsset,
} from "@/features/workOrders/schemas/workOrderSchemas"
import {
  generateWorkOrderFromPlan,
  isDuplicateWorkOrderError,
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"

const UNASSIGNED_VALUE = "unassigned"

function todayDateInputValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function eligibleAssetsForPlan(
  assets: WorkOrderRegistryAsset[],
  unitId: string,
  assetCategoryId: string,
): WorkOrderRegistryAsset[] {
  return assets.filter(
    (asset) =>
      asset.unitId === unitId &&
      asset.categoryId === assetCategoryId &&
      asset.status === "Active",
  )
}

export function GenerateWorkOrderDialog({
  open,
  onOpenChange,
  planId,
  unitId,
  assetCategoryId,
  onGenerated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  unitId: string
  assetCategoryId: string
  onGenerated: (workOrder: WorkOrder) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<WorkOrderRegistryAsset[]>([])
  const [technicians, setTechnicians] = useState<TechnicianUser[]>([])
  const [isLoadingLookups, setIsLoadingLookups] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const inFlightRef = useRef(false)

  const formSchema = useMemo(
    () =>
      generateWorkOrderFromPlanFormSchema({
        assetRequired: t("workOrders.create.validation.assetRequired"),
        dateRequired: t("workOrders.create.validation.dateRequired"),
      }),
    [t],
  )

  const form = useForm<GenerateWorkOrderFromPlanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assetId: "",
      assignedUserId: undefined,
      scheduledDate: todayDateInputValue(),
    },
  })

  const watchedValues = useWatch({ control: form.control })
  const isValid = formSchema.safeParse(watchedValues).success

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true)
    setLookupError(null)

    try {
      const [assetData, technicianData] = await Promise.all([
        listWorkOrderAssets(),
        getTechnicians(),
      ])
      setAssets(eligibleAssetsForPlan(assetData, unitId, assetCategoryId))
      setTechnicians(technicianData)
    } catch (error: unknown) {
      setLookupError(
        error instanceof Error
          ? error.message
          : t("pmoc.plans.generate.errors.loadLookupsFailed"),
      )
    } finally {
      setIsLoadingLookups(false)
    }
  }, [assetCategoryId, t, unitId])

  useEffect(() => {
    if (!open) {
      return
    }

    setSubmitError(null)
    form.reset({
      assetId: "",
      assignedUserId: undefined,
      scheduledDate: todayDateInputValue(),
    })
    void loadLookups()
  }, [form, loadLookups, open])

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

  async function onSubmit(values: GenerateWorkOrderFromPlanFormValues) {
    if (inFlightRef.current || isPending) {
      return
    }

    inFlightRef.current = true
    setIsPending(true)
    setSubmitError(null)

    try {
      const created = await generateWorkOrderFromPlan({
        planId,
        assetId: values.assetId,
        assignedUserId: values.assignedUserId ?? null,
        scheduledDate: values.scheduledDate,
      })

      toast.success(t("pmoc.plans.generate.success"), {
        action: {
          label: t("pmoc.plans.generate.viewWorkOrder"),
          onClick: () => {
            void navigate(`/os/${created.id}`)
          },
        },
      })
      onGenerated(created)
      onOpenChange(false)
    } catch (error: unknown) {
      if (isDuplicateWorkOrderError(error)) {
        setSubmitError(error.message)
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.plans.generate.errors.generateFailed")
      setSubmitError(message)
      toast.error(message)
    } finally {
      inFlightRef.current = false
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("pmoc.plans.generate.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("pmoc.plans.generate.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        {isLoadingLookups ? (
          <p className="text-sm text-muted-foreground">
            {t("workOrders.loading")}
          </p>
        ) : null}

        {lookupError !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {lookupError}
          </p>
        ) : null}

        {!isLoadingLookups && assets.length === 0 && lookupError === null ? (
          <p className="text-sm text-muted-foreground">
            {t("pmoc.plans.generate.emptyAssets")}
          </p>
        ) : null}

        {!isLoadingLookups && assets.length > 0 ? (
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void form.handleSubmit(onSubmit)(event)
              }}
              noValidate
            >
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
                      disabled={isPending}
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
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("workOrders.create.form.scheduledDate")}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" disabled={isPending} {...field} />
                    </FormControl>
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
                      disabled={isPending}
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

              {submitError !== null ? (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              ) : null}

              <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    onOpenChange(false)
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <FormPrimaryButton
                  type="submit"
                  isValid={isValid}
                  loading={isPending || form.formState.isSubmitting}
                  loadingLabel={t("pmoc.plans.actions.generating")}
                >
                  {t("pmoc.plans.generate.submit")}
                </FormPrimaryButton>
              </DialogFooter>
            </form>
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
