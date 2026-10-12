import { useCallback, useEffect, useRef, useState } from "react"
import type { TFunction } from "i18next"
import { toast } from "sonner"

import {
  createTeacherLesson,
  fetchAdminScheduleDay,
  listAdminRentalAssets,
  removeTeacherLesson,
  type AdminDaySchedule,
  type AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"

type LessonSlot = AdminDaySchedule["slots"][number]

export function useTeacherLessons(t: TFunction) {
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [day, setDay] = useState<AdminDaySchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const latestDayRequest = useRef(0)

  useEffect(() => {
    let cancelled = false
    void listAdminRentalAssets()
      .then((result) => {
        if (cancelled) return
        setAssets(result.filter((asset) => asset.isActive && asset.type === "Location" && asset.schedulePolicy === "SlotGrid"))
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : t("rentals.teacherLessons.loadError")))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  const loadDay = useCallback(async (assetId: string, date: string) => {
    const requestId = ++latestDayRequest.current
    setDay(null)
    try {
      const result = await fetchAdminScheduleDay(date, [assetId])
      if (requestId !== latestDayRequest.current) return null
      setDay(result)
      return result
    } catch (error) {
      if (requestId === latestDayRequest.current) {
        setDay(null)
        toast.error(error instanceof Error ? error.message : t("rentals.teacherLessons.loadError"))
      }
      return null
    }
  }, [t])

  const create = useCallback(async ({ assetId, date, slot, label }: {
    assetId: string
    date: string
    slot: LessonSlot
    label: string
  }) => {
    setBusy(true)
    try {
      await createTeacherLesson({ rentalAssetId: assetId, date, startTime: slot.startTime, endTime: slot.endTime, label: label.trim() || null })
      toast.success(t("rentals.teacherLessons.createSuccess"))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("rentals.teacherLessons.changeError")
      toast.error(message)
      throw error
    } finally { setBusy(false) }
  }, [t])

  const remove = useCallback(async (assetId: string, date: string, startTime: string, endTime: string) => {
    setBusy(true)
    try {
      await removeTeacherLesson({ rentalAssetId: assetId, date, startTime, endTime })
      toast.success(t("rentals.teacherLessons.removeSuccess"))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("rentals.teacherLessons.changeError")
      toast.error(message)
      throw error
    } finally { setBusy(false) }
  }, [t])

  return { assets, day, loading, busy, loadDay, create, remove }
}
