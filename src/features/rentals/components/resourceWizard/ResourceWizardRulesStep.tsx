import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { SchedulePolicyPanel } from "@/features/rentals/components/schedule/SchedulePolicyPanel"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import { scheduleDeepLink } from "@/features/rentals/components/resourceWizard/wizardSteps"
import {
  formatScheduleTime,
  type AdminRentalAsset,
  type OccupancyKind,
  type ScheduleTemplate,
  type UpdateSchedulePolicyInput,
} from "@/features/rentals/services/scheduleService"

type ResourceWizardRulesStepProps = {
  asset: AdminRentalAsset
  wizardPath: string
  canRead: boolean
  templates: readonly ScheduleTemplate[]
  kinds: readonly OccupancyKind[]
  busy: boolean
  busyAction: ScheduleBusyAction | null
  readOnly: boolean
  onSavePolicy: (input: UpdateSchedulePolicyInput) => Promise<void>
  onSeed: () => void
}

export function ResourceWizardRulesStep({
  asset,
  wizardPath,
  canRead,
  templates,
  kinds,
  busy,
  busyAction,
  readOnly,
  onSavePolicy,
  onSeed,
}: ResourceWizardRulesStepProps) {
  const { t } = useTranslation()
  const active = templates.filter((template) => template.isActive)
  const bookableKinds = kinds.filter((kind) => kind.isActive && kind.isBookableByCustomer)

  return (
    <section className="space-y-4" aria-labelledby="wizard-rules-title">
      <div>
        <h2 id="wizard-rules-title" className="text-lg font-semibold">
          {t("rentals.resourceWizard.rules.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("rentals.resourceWizard.rules.description")}
        </p>
      </div>
      {canRead ? (
        <SchedulePolicyPanel
          embedded
          assets={[asset]}
          templates={templates}
          busy={busy}
          busyAction={busyAction}
          readOnly={readOnly}
          onSave={onSavePolicy}
          onSeedSlotGrid={onSeed}
        />
      ) : (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm" role="status">
          {t("rentals.resourceWizard.permission")}
        </p>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("rentals.resourceWizard.rules.templates")}</h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("rentals.resourceWizard.rules.templatesEmpty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {active.map((template) => (
              <li key={template.id} className="rounded-full border border-border px-3 py-1 text-sm">
                {t(`rentals.schedule.days.${template.dayOfWeek}`, { defaultValue: template.dayOfWeek })}
                {" · "}
                {formatScheduleTime(template.startTime)}–{formatScheduleTime(template.endTime)}
              </li>
            ))}
          </ul>
        )}
        {active.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("rentals.resourceWizard.rules.templatesCount", { count: active.length })}
          </p>
        ) : null}
      </div>
      {bookableKinds.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("rentals.resourceWizard.items.occupancyKinds")}>
          {bookableKinds.map((kind) => (
            <li key={kind.id} className="rounded-full bg-muted px-3 py-1 text-sm">{kind.label}</li>
          ))}
        </ul>
      ) : null}
      {canRead ? (
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          to={scheduleDeepLink(asset.id, "semana", wizardPath)}
        >
          {t("rentals.resourceWizard.rules.openSchedule")}
        </Link>
      ) : null}
    </section>
  )
}
