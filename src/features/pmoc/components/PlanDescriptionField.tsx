import { useState } from "react"
import { Plus } from "lucide-react"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import type { CreatePlanFormValues } from "@/features/pmoc/schemas/maintenancePlanSchemas"

/** Optional description: a text button until it has content or the user asks for it. */
export function PlanDescriptionField({
  control,
  hasValue,
}: {
  control: Control<CreatePlanFormValues>
  hasValue: boolean
}) {
  const { t } = useTranslation()
  const [requested, setRequested] = useState(false)

  if (!hasValue && !requested) {
    return (
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 px-2"
          onClick={() => {
            setRequested(true)
          }}
        >
          <Plus data-icon="inline-start" />
          {t("pmoc.newPlan.form.addDescription")}
        </Button>
      </div>
    )
  }

  return (
    <FormField
      control={control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("pmoc.create.form.description")}</FormLabel>
          <FormControl>
            <Textarea
              autoFocus={requested && !hasValue}
              placeholder={t("pmoc.create.form.descriptionPlaceholder")}
              {...field}
            />
          </FormControl>
        </FormItem>
      )}
    />
  )
}
