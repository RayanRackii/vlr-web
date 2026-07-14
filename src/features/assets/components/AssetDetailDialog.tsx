import { useCallback, useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Asset, AssetStatus } from "@/features/assets/schemas/assetSchemas"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import {
  getAssetById,
  updateAsset,
} from "@/features/assets/services/assetsService"
import {
  createAssetPricing,
  deleteAssetPricing,
  getAssetPricings,
  type RentalPricing,
} from "@/features/assets/services/rentalPricingService"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"

type AssetDetailDialogProps = {
  assetId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  units: Unit[]
  categories: AssetCategory[]
  onUpdated: () => void
}

const generalFormSchema = z.object({
  name: z.string().trim().min(1),
  tag: z.string().trim().min(1),
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  location: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Maintenance"]),
  isRentable: z.boolean(),
  requiresMaintenance: z.boolean(),
  rentalType: z.enum(["Location", "Good"]),
  totalQuantity: z.number().int().min(1),
})

type GeneralFormValues = z.infer<typeof generalFormSchema>

const pricingFormSchema = z.object({
  dayOfWeek: z.enum([
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  pricePerHour: z.number().nonnegative(),
  requiresDeposit: z.boolean(),
  depositPercentage: z.number().min(0).max(100),
})

type PricingFormValues = z.infer<typeof pricingFormSchema>

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export function AssetDetailDialog({
  assetId,
  open,
  onOpenChange,
  units,
  categories,
  onUpdated,
}: AssetDetailDialogProps) {
  const { t } = useTranslation()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pricings, setPricings] = useState<RentalPricing[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])

  const generalForm = useForm<GeneralFormValues>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: {
      name: "",
      tag: "",
      unitId: "",
      categoryId: "",
      location: "",
      serialNumber: "",
      status: "Active",
      isRentable: false,
      requiresMaintenance: false,
      rentalType: "Location",
      totalQuantity: 1,
    },
  })

  const pricingForm = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: {
      dayOfWeek: "Monday",
      startTime: "08:00",
      endTime: "18:00",
      pricePerHour: 0,
      requiresDeposit: false,
      depositPercentage: 0,
    },
  })

  const isRentable = generalForm.watch("isRentable")
  const requiresMaintenance = generalForm.watch("requiresMaintenance")

  const loadDetail = useCallback(async () => {
    if (!assetId) {
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const loaded = await getAssetById(assetId)
      setAsset(loaded)
      generalForm.reset({
        name: loaded.name,
        tag: loaded.tag,
        unitId: loaded.unitId,
        categoryId: loaded.categoryId,
        location: loaded.location ?? "",
        serialNumber: loaded.serialNumber ?? "",
        status: loaded.status as AssetStatus,
        isRentable: loaded.isRentable,
        requiresMaintenance: loaded.requiresMaintenance,
        rentalType: loaded.rentalConfig?.type ?? "Location",
        totalQuantity: loaded.rentalConfig?.totalQuantity ?? 1,
      })

      if (loaded.isRentable) {
        const pricingRows = await getAssetPricings(loaded.id)
        setPricings(pricingRows)
      } else {
        setPricings([])
      }

      if (loaded.requiresMaintenance) {
        const orders = await getWorkOrders(loaded.id)
        setWorkOrders(orders)
      } else {
        setWorkOrders([])
      }
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("assets.detail.errors.loadFailed"),
      )
      setAsset(null)
    } finally {
      setIsLoading(false)
    }
  }, [assetId, generalForm, t])

  useEffect(() => {
    if (open && assetId) {
      void loadDetail()
    }
  }, [open, assetId, loadDetail])

  async function handleSaveGeneral(values: GeneralFormValues) {
    if (!asset) {
      return
    }

    setSaveError(null)

    try {
      const updated = await updateAsset(asset.id, {
        unitId: values.unitId,
        categoryId: values.categoryId,
        name: values.name,
        tag: values.tag,
        location: values.location || null,
        serialNumber: values.serialNumber || null,
        installationDate: asset.installationDate ?? null,
        status: values.status,
        isRentable: values.isRentable,
        requiresMaintenance: values.requiresMaintenance,
        rentalType: values.rentalType,
        totalQuantity: values.totalQuantity,
      })

      setAsset(updated)
      onUpdated()

      if (updated.isRentable) {
        setPricings(await getAssetPricings(updated.id))
      } else {
        setPricings([])
      }

      if (updated.requiresMaintenance) {
        setWorkOrders(await getWorkOrders(updated.id))
      } else {
        setWorkOrders([])
      }
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t("assets.detail.errors.updateFailed"),
      )
    }
  }

  async function handleAddPricing(values: PricingFormValues) {
    if (!asset) {
      return
    }

    setSaveError(null)

    try {
      await createAssetPricing(asset.id, values)
      pricingForm.reset({
        dayOfWeek: "Monday",
        startTime: "08:00",
        endTime: "18:00",
        pricePerHour: 0,
        requiresDeposit: false,
        depositPercentage: 0,
      })
      setPricings(await getAssetPricings(asset.id))
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t("assets.detail.errors.pricingCreateFailed"),
      )
    }
  }

  async function handleDeletePricing(pricingId: string) {
    if (!asset) {
      return
    }

    try {
      await deleteAssetPricing(asset.id, pricingId)
      setPricings(await getAssetPricings(asset.id))
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t("assets.detail.errors.pricingDeleteFailed"),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("assets.detail.title")}</DialogTitle>
          <DialogDescription>{t("assets.detail.description")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {t("common.loading")}
          </div>
        ) : null}

        {loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}

        {asset && !isLoading ? (
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">
                {t("assets.detail.tabs.general")}
              </TabsTrigger>
              {isRentable ? (
                <TabsTrigger value="rental">
                  {t("assets.detail.tabs.rental")}
                </TabsTrigger>
              ) : null}
              {requiresMaintenance ? (
                <TabsTrigger value="maintenance">
                  {t("assets.detail.tabs.maintenance")}
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="general" className="mt-4 space-y-4">
              <Form {...generalForm}>
                <form
                  className="space-y-4"
                  onSubmit={generalForm.handleSubmit((values) => {
                    void handleSaveGeneral(values)
                  })}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={generalForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("assets.detail.fields.name")}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={generalForm.control}
                      name="tag"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("assets.detail.fields.tag")}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={generalForm.control}
                      name="unitId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("assets.detail.fields.unit")}</FormLabel>
                          <Select
                            modal={false}
                            value={field.value}
                            onValueChange={field.onChange}
                            items={units.map((unit) => ({
                              value: unit.id,
                              label: unit.name,
                            }))}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue />
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
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={generalForm.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("assets.detail.fields.category")}
                          </FormLabel>
                          <Select
                            modal={false}
                            value={field.value}
                            onValueChange={field.onChange}
                            items={categories.map((category) => ({
                              value: category.id,
                              label: category.name,
                            }))}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem
                                  key={category.id}
                                  value={category.id}
                                >
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={generalForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("assets.detail.fields.location")}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={generalForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("assets.detail.fields.status")}
                          </FormLabel>
                          <Select
                            modal={false}
                            value={field.value}
                            onValueChange={field.onChange}
                            items={[
                              {
                                value: "Active",
                                label: t("assets.inventory.status.Active"),
                              },
                              {
                                value: "Inactive",
                                label: t("assets.inventory.status.Inactive"),
                              },
                              {
                                value: "Maintenance",
                                label: t(
                                  "assets.inventory.status.Maintenance",
                                ),
                              },
                            ]}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Active">
                                {t("assets.inventory.status.Active")}
                              </SelectItem>
                              <SelectItem value="Inactive">
                                {t("assets.inventory.status.Inactive")}
                              </SelectItem>
                              <SelectItem value="Maintenance">
                                {t("assets.inventory.status.Maintenance")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
                    <FormField
                      control={generalForm.control}
                      name="isRentable"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-3">
                          <FormLabel>
                            {t("assets.detail.fields.isRentable")}
                          </FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={generalForm.control}
                      name="requiresMaintenance"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-3">
                          <FormLabel>
                            {t("assets.detail.fields.requiresMaintenance")}
                          </FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {isRentable ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={generalForm.control}
                        name="rentalType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("assets.detail.fields.rentalType")}
                            </FormLabel>
                            <Select
                              modal={false}
                              value={field.value}
                              onValueChange={field.onChange}
                              items={[
                                {
                                  value: "Location",
                                  label: t("assets.detail.rentalTypes.Location"),
                                },
                                {
                                  value: "Good",
                                  label: t("assets.detail.rentalTypes.Good"),
                                },
                              ]}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Location">
                                  {t("assets.detail.rentalTypes.Location")}
                                </SelectItem>
                                <SelectItem value="Good">
                                  {t("assets.detail.rentalTypes.Good")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={generalForm.control}
                        name="totalQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("assets.detail.fields.totalQuantity")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                value={field.value}
                                onChange={(event) => {
                                  field.onChange(Number(event.target.value))
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}

                  {saveError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {saveError}
                    </p>
                  ) : null}

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={generalForm.formState.isSubmitting}
                    >
                      {generalForm.formState.isSubmitting
                        ? t("assets.detail.actions.saving")
                        : t("assets.detail.actions.save")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>

            {isRentable ? (
              <TabsContent value="rental" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("assets.detail.rental.pricingTitle")}
                  </p>
                  {pricings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("assets.detail.rental.pricingEmpty")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {pricings.map((pricing) => (
                        <li
                          key={pricing.id}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <span>
                            {t(`assets.detail.days.${pricing.dayOfWeek}`)}{" "}
                            {pricing.startTime.slice(0, 5)}–
                            {pricing.endTime.slice(0, 5)} ·{" "}
                            {pricing.pricePerHour.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                            /h
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              void handleDeletePricing(pricing.id)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Form {...pricingForm}>
                  <form
                    className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2"
                    onSubmit={pricingForm.handleSubmit((values) => {
                      void handleAddPricing(values)
                    })}
                  >
                    <FormField
                      control={pricingForm.control}
                      name="dayOfWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("assets.detail.rental.dayOfWeek")}
                          </FormLabel>
                          <Select
                            modal={false}
                            value={field.value}
                            onValueChange={field.onChange}
                            items={DAYS.map((day) => ({
                              value: day,
                              label: t(`assets.detail.days.${day}`),
                            }))}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DAYS.map((day) => (
                                <SelectItem key={day} value={day}>
                                  {t(`assets.detail.days.${day}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={pricingForm.control}
                      name="pricePerHour"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("assets.detail.rental.pricePerHour")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={field.value}
                              onChange={(event) => {
                                field.onChange(Number(event.target.value))
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={pricingForm.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("assets.detail.rental.startTime")}
                          </FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={pricingForm.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("assets.detail.rental.endTime")}
                          </FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="sm:col-span-2">
                      <Button
                        type="submit"
                        disabled={pricingForm.formState.isSubmitting}
                      >
                        {t("assets.detail.rental.addPricing")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
            ) : null}

            {requiresMaintenance ? (
              <TabsContent value="maintenance" className="mt-4 space-y-3">
                <p className="text-sm font-medium">
                  {t("assets.detail.maintenance.title")}
                </p>
                {workOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("assets.detail.maintenance.empty")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {workOrders.map((order) => (
                      <li
                        key={order.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span>
                          {order.scheduledDate} · {order.asset.tag}
                        </span>
                        <Badge variant="outline">{order.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            ) : null}
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
