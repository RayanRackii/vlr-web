import { useEffect, useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { toHtmlTimeInput } from "@/features/assets/schemas/assetSchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import {
  createRentalResourceFormSchema,
  type RentalResourceFormValues,
} from "@/features/rentals/schemas/rentalResourceSchemas"
import type { RegistryCategoryListItem } from "@/features/rentals/schemas/rentalResourceSchemas"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"

type RentalResourceSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: AdminRentalAsset | null
  units: readonly Unit[]
  categories: readonly RegistryCategoryListItem[]
  families: readonly AssetFamily[]
  busy: boolean
  readOnly: boolean
  onSubmit: (values: RentalResourceFormValues) => Promise<boolean>
}

function pickSingleId(items: readonly { id: string }[]): string {
  return items.length === 1 ? (items[0]?.id ?? "") : ""
}

export function buildRentalResourceFormValues(
  editing: AdminRentalAsset | null,
  units: readonly Unit[],
  categories: readonly RegistryCategoryListItem[],
  families: readonly AssetFamily[],
): RentalResourceFormValues {
  const rentalType = editing?.type === "Good" ? "Good" : "Location"

  return {
    name: editing?.name ?? "",
    tag: "",
    unitId: editing?.unitId ?? pickSingleId(units),
    categoryId: editing?.categoryId ?? pickSingleId(categories),
    familyId: pickSingleId(families),
    rentalType,
    totalQuantity: editing?.totalQuantity ?? 1,
    requiresDeposit: editing?.requiresDeposit ?? true,
    queueEnabled: rentalType === "Location" ? (editing?.queueEnabled ?? false) : false,
    queueOpeningTime: toHtmlTimeInput(editing?.queueOpeningTime),
    location: "",
  }
}

export function RentalResourceSheet({
  open,
  onOpenChange,
  editing,
  units,
  categories,
  families,
  busy,
  readOnly,
  onSubmit,
}: RentalResourceSheetProps) {
  const { t } = useTranslation()

  const formSchema = useMemo(
    () =>
      createRentalResourceFormSchema({
        nameRequired: t("rentals.resources.validation.nameRequired"),
        tagRequired: t("rentals.resources.validation.tagRequired"),
        unitRequired: t("rentals.resources.validation.unitRequired"),
        categoryRequired: t("rentals.resources.validation.categoryRequired"),
        familyRequired: t("rentals.resources.validation.familyRequired"),
        quantityMin: t("rentals.resources.validation.quantityMin"),
        queueOpeningTimeRequired: t(
          "rentals.resources.validation.queueOpeningTimeRequired",
        ),
      }),
    [t],
  )

  const form = useForm<RentalResourceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildRentalResourceFormValues(
      editing,
      units,
      categories,
      families,
    ),
  })

  useEffect(() => {
    if (!open) {
      return
    }

    form.reset(
      buildRentalResourceFormValues(editing, units, categories, families),
    )
  }, [categories, editing, families, form, open, units])

  const watched = useWatch({ control: form.control })
  const rentalType = watched.rentalType ?? "Location"
  const queueEnabled = watched.queueEnabled ?? false
  const isValid = formSchema.safeParse(watched).success

  const unitItems = units.map((unit) => ({ value: unit.id, label: unit.name }))
  const categoryItems = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }))
  const familyItems = families.map((family) => ({
    value: family.id,
    label: family.label,
  }))
  const typeItems = [
    { value: "Location", label: t("rentals.resources.typeLocation") },
    { value: "Good", label: t("rentals.resources.typeGood") },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {editing
              ? t("rentals.resources.edit")
              : t("rentals.resources.add")}
          </SheetTitle>
          <SheetDescription>
            {t("rentals.resources.formDescription")}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit(async (values) => {
                const ok = await onSubmit(values)
                if (ok) {
                  onOpenChange(false)
                }
              })(event)
            }}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.name")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      disabled={readOnly}
                      placeholder={t("rentals.resources.form.namePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.tag")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      disabled={readOnly}
                      placeholder={t("rentals.resources.form.tagPlaceholder")}
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
                  <FormLabel>{t("rentals.resources.form.unit")}</FormLabel>
                  <Select
                    modal={false}
                    onValueChange={field.onChange}
                    value={field.value}
                    items={unitItems}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t("rentals.resources.form.unitPlaceholder")}
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
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.category")}</FormLabel>
                  <Select
                    modal={false}
                    onValueChange={field.onChange}
                    value={field.value}
                    items={categoryItems}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t(
                            "rentals.resources.form.categoryPlaceholder",
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
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="familyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.family")}</FormLabel>
                  <Select
                    modal={false}
                    onValueChange={field.onChange}
                    value={field.value}
                    items={familyItems}
                    disabled={readOnly || families.length === 1}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t(
                            "rentals.resources.form.familyPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {families.map((family) => (
                        <SelectItem key={family.id} value={family.id}>
                          {family.label}
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
              name="rentalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.rentalType")}</FormLabel>
                  <Select
                    modal={false}
                    onValueChange={(value) => {
                      field.onChange(value)
                      if (value === "Good") {
                        form.setValue("queueEnabled", false)
                        form.setValue("queueOpeningTime", "")
                      } else {
                        form.setValue("totalQuantity", 1)
                      }
                    }}
                    value={field.value}
                    items={typeItems}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Location">
                        {t("rentals.resources.typeLocation")}
                      </SelectItem>
                      <SelectItem value="Good">
                        {t("rentals.resources.typeGood")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {rentalType === "Good" ? (
              <FormField
                control={form.control}
                name="totalQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("rentals.resources.form.totalQuantity")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        disabled={readOnly}
                        value={field.value}
                        onChange={(event) => {
                          field.onChange(Number(event.target.value) || 0)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="requiresDeposit"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <FormLabel className="m-0">
                    {t("rentals.resources.form.requiresDeposit")}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      disabled={readOnly}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {rentalType === "Location" ? (
              <>
                <FormField
                  control={form.control}
                  name="queueEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                      <FormLabel className="m-0">
                        {t("rentals.resources.form.queueEnabled")}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          disabled={readOnly}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {queueEnabled ? (
                  <FormField
                    control={form.control}
                    name="queueOpeningTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("rentals.resources.form.queueOpeningTime")}
                        </FormLabel>
                        <FormControl>
                          <Input type="time" disabled={readOnly} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </>
            ) : null}

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.resources.form.location")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      disabled={readOnly}
                      placeholder={t(
                        "rentals.resources.form.locationPlaceholder",
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-popover px-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                }}
              >
                {t("common.cancel")}
              </Button>
              <FormPrimaryButton
                type="submit"
                isValid={isValid}
                loading={busy}
                disabled={readOnly}
              >
                {editing
                  ? t("rentals.resources.saveEdit")
                  : t("rentals.resources.saveCreate")}
              </FormPrimaryButton>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
