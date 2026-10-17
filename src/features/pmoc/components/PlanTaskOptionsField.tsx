import { type Control, useController } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import type { CreatePlanFormValues } from "@/features/pmoc/schemas/maintenancePlanSchemas"

export function PlanTaskOptionsField({
  control,
  index,
}: {
  control: Control<CreatePlanFormValues>
  index: number
}) {
  const { t } = useTranslation()
  const { field } = useController({
    control,
    name: `tasks.${index}.options`,
  })

  return (
    <FormItem>
      <FormLabel>{t("pmoc.create.tasks.options")}</FormLabel>
      <FormControl>
        <Textarea
          rows={3}
          value={(field.value ?? []).join("\n")}
          placeholder={t("pmoc.create.tasks.optionsPlaceholder")}
          onChange={(event) => {
            field.onChange(event.target.value.split("\n"))
          }}
        />
      </FormControl>
      <p className="text-xs text-muted-foreground">
        {t("pmoc.create.tasks.optionsHint")}
      </p>
      <FormMessage />
    </FormItem>
  )
}
