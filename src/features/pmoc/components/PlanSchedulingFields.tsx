import type { Control, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

export function PlanSchedulingFields<T extends FieldValues>({
  control,
  showEditHint = false,
}: {
  control: Control<T>
  showEditHint?: boolean
}) {
  const { t } = useTranslation()

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">
        {t("pmoc.scheduling.title")}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name={"intervalDays" as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("pmoc.scheduling.interval")}</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    autoComplete="off"
                    className="w-28"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={
                      typeof field.value === "number" &&
                      Number.isFinite(field.value)
                        ? field.value
                        : ""
                    }
                    onChange={(event) => {
                      const raw = event.target.value
                      field.onChange(
                        raw === "" ? Number.NaN : event.target.valueAsNumber,
                      )
                    }}
                  />
                </FormControl>
                <span className="text-sm text-muted-foreground">
                  {t("pmoc.scheduling.days")}
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={"firstDueDate" as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("pmoc.scheduling.firstDue")}</FormLabel>
              <FormControl>
                <Input type="date" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <p className="text-sm text-muted-foreground">{t("pmoc.scheduling.helper")}</p>
      {showEditHint ? (
        <p className="text-sm text-muted-foreground">
          {t("pmoc.scheduling.editHint")}
        </p>
      ) : null}
    </fieldset>
  )
}
