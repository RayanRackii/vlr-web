import { useTranslation } from "react-i18next"

import { mapGlobalTemplateTaskToFormTask } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import type { TaskInputType } from "@/features/pmoc/schemas/maintenancePlanSchemas"

export function TaskConfigurationReadout({
  inputType,
  configuration,
}: {
  inputType: TaskInputType
  configuration?: string | null
}) {
  const { t } = useTranslation()
  const mapped = mapGlobalTemplateTaskToFormTask({
    title: "task",
    inputType,
    isMandatory: false,
    configuration,
  })

  if (inputType === "Number") {
    const parts: string[] = []

    if (mapped.min != null) {
      parts.push(`${t("pmoc.create.tasks.min")}: ${mapped.min}`)
    }

    if (mapped.max != null) {
      parts.push(`${t("pmoc.create.tasks.max")}: ${mapped.max}`)
    }

    if (mapped.unit != null && mapped.unit.trim().length > 0) {
      parts.push(`${t("pmoc.create.tasks.unit")}: ${mapped.unit}`)
    }

    if (parts.length === 0) {
      return null
    }

    return <p className="text-muted-foreground">{parts.join(" · ")}</p>
  }

  if (inputType === "SingleChoice" && (mapped.options?.length ?? 0) > 0) {
    return (
      <p className="text-muted-foreground">
        {t("pmoc.create.tasks.options")}: {mapped.options?.join(", ")}
      </p>
    )
  }

  return null
}
