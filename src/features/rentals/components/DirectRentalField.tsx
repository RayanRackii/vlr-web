import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { setDirectRental } from "@/features/rentals/services/scheduleService"

export function DirectRentalField({
  assetId,
  directRental,
  canWrite,
  onSaved,
}: {
  assetId: string
  directRental?: boolean
  canWrite: boolean
  onSaved?: () => void
}) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<{ source: boolean | undefined; value: boolean }>({
    source: directRental,
    value: directRental !== false,
  })
  if (choice.source !== directRental) {
    setChoice({ source: directRental, value: directRental !== false })
  }
  const value = choice.value
  const [busy, setBusy] = useState(false)

  async function choose(next: boolean) {
    if (!canWrite || next === value) return
    setBusy(true)
    try {
      const saved = await setDirectRental(assetId, next)
      setChoice({ source: directRental, value: saved.directRental !== false })
      onSaved?.()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("rentals.resources.errors.save"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("rentals.resources.directRentalOn")}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("rentals.resources.directRentalOn")}>
        <Button type="button" variant={value ? "default" : "outline"} aria-pressed={value} disabled={!canWrite || busy} onClick={() => { void choose(true) }}>
          {t("rentals.resources.directRentalOn")}
        </Button>
        <Button type="button" variant={!value ? "default" : "outline"} aria-pressed={!value} disabled={!canWrite || busy} onClick={() => { void choose(false) }}>
          {t("rentals.resources.directRentalOff")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("rentals.resources.directRentalHelp")}</p>
    </fieldset>
  )
}
