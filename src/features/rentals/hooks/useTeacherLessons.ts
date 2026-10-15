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

type LocalWrite = {
  assetId: string
  date: string
  slot: LessonSlot
}

export function isUnreservedAvailable(slot: { status: string; reservationId?: string | null }) {
  return slot.status === "Available" && !slot.reservationId
}

function sameCivilDate(actual: string, expected: string) {
  return actual.slice(0, 10) === expected.slice(0, 10)
}

function sameClock(actual: string, expected: string) {
  return actual.slice(0, 8) === expected.slice(0, 8)
}

function dayKey(assetId: string, date: string) {
  return `${assetId}|${date.slice(0, 10)}`
}

function matchesRequestedInterval(
  slot: LessonSlot,
  assetId: string,
  date: string,
  startTime: string,
  endTime: string,
) {
  return slot.rentalAssetId === assetId
    && sameCivilDate(slot.date, date)
    && sameClock(slot.startTime, startTime)
    && sameClock(slot.endTime, endTime)
    && isUnreservedAvailable(slot)
}

function sameClockInterval(slot: LessonSlot, assetId: string, startTime: string, endTime: string) {
  return slot.rentalAssetId === assetId
    && sameClock(slot.startTime, startTime)
    && sameClock(slot.endTime, endTime)
}

export function compareSlotsByStartTime(
  left: { startTime: string; endTime: string },
  right: { startTime: string; endTime: string },
) {
  const start = left.startTime.localeCompare(right.startTime)
  return start !== 0 ? start : left.endTime.localeCompare(right.endTime)
}

function replaceInterval(slots: LessonSlot[], assetId: string, startTime: string, endTime: string, next: LessonSlot) {
  return [
    ...slots.filter((slot) => !sameClockInterval(slot, assetId, startTime, endTime)),
    next,
  ].sort(compareSlotsByStartTime)
}

function applyWrites(day: AdminDaySchedule, writes: LocalWrite[], assetId: string, date: string) {
  let slots = day.slots
  const kept: LocalWrite[] = []
  for (const write of writes) {
    if (dayKey(write.assetId, write.date) !== dayKey(assetId, date)) {
      kept.push(write)
      continue
    }
    const match = slots.find((slot) => sameClockInterval(slot, write.assetId, write.slot.startTime, write.slot.endTime))
    if (match?.occupancyKindKey === write.slot.occupancyKindKey && isUnreservedAvailable(match)) continue
    if (match && !isUnreservedAvailable(match)) continue
    slots = replaceInterval(slots, write.assetId, write.slot.startTime, write.slot.endTime, write.slot)
    kept.push(write)
  }
  return { day: { ...day, slots }, writes: kept }
}

export type TeacherDayStatus = "idle" | "loading" | "ready" | "error"

export function useTeacherLessons(t: TFunction) {
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const [day, setDay] = useState<AdminDaySchedule | null>(null)
  const [dayStatus, setDayStatus] = useState<TeacherDayStatus>("idle")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const latestDayRequest = useRef(0)
  const dayRef = useRef<AdminDaySchedule | null>(null)
  const shownKey = useRef<string | null>(null)
  const writesRef = useRef<LocalWrite[]>([])

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

  const publishDay = useCallback((next: AdminDaySchedule, assetId: string, date: string) => {
    shownKey.current = dayKey(assetId, date)
    dayRef.current = next
    setDay(next)
    setDayStatus("ready")
  }, [])

  const rememberWrite = useCallback((slot: LessonSlot, assetId: string, date: string) => {
    const key = dayKey(assetId, date)
    writesRef.current = [
      ...writesRef.current.filter((write) => dayKey(write.assetId, write.date) !== key || !sameClock(write.slot.startTime, slot.startTime)),
      { assetId, date, slot },
    ]
    const base = shownKey.current === key && dayRef.current
      ? dayRef.current
      : { date, slots: [] }
    publishDay({ ...base, slots: replaceInterval(base.slots, assetId, slot.startTime, slot.endTime, slot) }, assetId, date)
  }, [publishDay])

  const loadDay = useCallback(async (assetId: string, date: string) => {
    const requestId = ++latestDayRequest.current
    const key = dayKey(assetId, date)
    const refreshingSameDay = shownKey.current === key && dayRef.current !== null
    if (!refreshingSameDay) {
      dayRef.current = null
      setDay(null)
      setDayStatus("loading")
    }
    try {
      const result = await fetchAdminScheduleDay(date, [assetId])
      if (requestId !== latestDayRequest.current) return null
      const merged = applyWrites(result, writesRef.current, assetId, date)
      writesRef.current = merged.writes
      publishDay(merged.day, assetId, date)
      return merged.day
    } catch (error) {
      if (requestId === latestDayRequest.current) {
        if (!refreshingSameDay) {
          dayRef.current = null
          setDay(null)
          setDayStatus("error")
        }
        toast.error(error instanceof Error ? error.message : t("rentals.teacherLessons.loadError"))
      }
      return refreshingSameDay ? dayRef.current : null
    }
  }, [publishDay, t])

  const create = useCallback(async ({ assetId, date, slot, label }: {
    assetId: string
    date: string
    slot: LessonSlot
    label: string
  }) => {
    setBusy(true)
    try {
      const created = await createTeacherLesson({ rentalAssetId: assetId, date, startTime: slot.startTime, endTime: slot.endTime, label: label.trim() || null })
      if (created.occupancyKindKey !== "lesson" || !matchesRequestedInterval(created, assetId, date, slot.startTime, slot.endTime)) {
        throw new Error(t("rentals.teacherLessons.changeError"))
      }
      rememberWrite(created, assetId, date)
      toast.success(t("rentals.teacherLessons.createSuccess"))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("rentals.teacherLessons.changeError")
      toast.error(message)
      throw error
    } finally { setBusy(false) }
  }, [rememberWrite, t])

  const remove = useCallback(async (assetId: string, date: string, startTime: string, endTime: string) => {
    setBusy(true)
    try {
      const opened = await removeTeacherLesson({ rentalAssetId: assetId, date, startTime, endTime })
      if (opened.occupancyKindKey !== "open" || !matchesRequestedInterval(opened, assetId, date, startTime, endTime)) {
        throw new Error(t("rentals.teacherLessons.changeError"))
      }
      rememberWrite(opened, assetId, date)
      toast.success(t("rentals.teacherLessons.removeSuccess"))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("rentals.teacherLessons.changeError")
      toast.error(message)
      throw error
    } finally { setBusy(false) }
  }, [rememberWrite, t])

  return { assets, day, dayStatus, loading, busy, loadDay, create, remove }
}
