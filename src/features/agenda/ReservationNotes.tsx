import { useState } from "react"
import { StickyNote } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RESERVATION_NOTES_MAX_LENGTH, updateReservationNotes } from "@/features/rentals/services/reservationsService"

type Props = {
  reservationId: string
  /** The note as loaded with the reservation. */
  notes: string | null
  canEdit: boolean
  /** Called after the note was saved so callers can refresh the reservations. */
  onSaved?: () => void
}

/** Internal staff note of a reservation in the agenda detail panel, with inline edit. */
export function ReservationNotes({ reservationId, notes, canEdit, onSaved }: Props) {
  const { t } = useTranslation()
  const [saved, setSaved] = useState(notes ?? "")
  const [seenNotes, setSeenNotes] = useState(notes)
  // A fresh note from the server (refetch, another editor) replaces the local copy.
  if (notes !== seenNotes) {
    setSeenNotes(notes)
    setSaved(notes ?? "")
  }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)

  if (!canEdit && saved === "") return null

  async function save() {
    if (busy) return
    setBusy(true)
    try {
      const updated = await updateReservationNotes(reservationId, draft)
      setSaved(updated.notes ?? "")
      setEditing(false)
      toast.success(t("agendas.reservationNotes.saved"))
      onSaved?.()
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("apiErrors.updateReservationNotes"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0 sm:col-span-2" data-testid="reservation-notes">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <StickyNote className="size-4 shrink-0" aria-hidden="true" />
        {t("agendas.reservationNotes.label")}
      </dt>
      <dd className="mt-1">
        {editing ? (
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void save() }}>
            <Label htmlFor="reservation-notes-edit" className="sr-only">{t("agendas.reservationNotes.label")}</Label>
            <Textarea id="reservation-notes-edit" rows={3} autoFocus maxLength={RESERVATION_NOTES_MAX_LENGTH} value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-20 w-full resize-y" disabled={busy} />
            <p className="text-right text-xs tabular-nums text-muted-foreground">{draft.length}/{RESERVATION_NOTES_MAX_LENGTH}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-11" disabled={busy}>{busy ? t("common.saveStatus.saving") : t("common.save")}</Button>
              <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className={saved ? "min-w-0 whitespace-pre-line break-words text-foreground" : "text-muted-foreground"}>{saved || t("agendas.reservationNotes.empty")}</p>
            {canEdit ? (
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => { setDraft(saved); setEditing(true) }}>
                {saved ? t("agendas.reservationNotes.edit") : t("agendas.reservationNotes.add")}
              </Button>
            ) : null}
          </div>
        )}
      </dd>
    </div>
  )
}
