import { useCallback, useEffect, useRef, useState } from "react"
import type { TFunction } from "i18next"
import { toast } from "sonner"

import i18n from "@/lib/i18n"

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

const REMOVED_LESSONS_STORAGE_KEY = "rolvix.teacherLessons.removed"

type RemovalRecord = {
  assetId: string
  date: string
  startTime: string
  endTime: string
  slot: LessonSlot
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isLessonSlot(value: unknown): value is LessonSlot {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.rentalAssetId === "string" &&
    typeof value.date === "string" &&
    typeof value.startTime === "string" &&
    typeof value.endTime === "string" &&
    typeof value.occupancyKindKey === "string" &&
    typeof value.status === "string"
  )
}

function isRemovalRecord(value: unknown): value is RemovalRecord {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.assetId === "string" &&
    typeof value.date === "string" &&
    typeof value.startTime === "string" &&
    typeof value.endTime === "string" &&
    isLessonSlot(value.slot)
  )
}

function readRemovals(): RemovalRecord[] {
  if (typeof sessionStorage === "undefined") {
    return []
  }
  try {
    const raw = sessionStorage.getItem(REMOVED_LESSONS_STORAGE_KEY)
    if (raw === null || raw.length === 0) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(isRemovalRecord)
  } catch {
    return []
  }
}

function writeRemovals(records: readonly RemovalRecord[]): void {
  if (typeof sessionStorage === "undefined") {
    return
  }
  try {
    if (records.length === 0) {
      sessionStorage.removeItem(REMOVED_LESSONS_STORAGE_KEY)
      return
    }
    sessionStorage.setItem(REMOVED_LESSONS_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // The in-memory write still hides the lesson until this tab reloads.
  }
}

export function resetRemovedTeacherLessonsForTests(): void {
  writeRemovals([])
}

function removalIntervalKey(
  assetId: string,
  date: string,
  startTime: string,
  endTime: string,
): string {
  return `${assetId}|${date.slice(0, 10)}|${startTime.slice(0, 8)}|${endTime.slice(0, 8)}`
}

function rememberRemoval(record: RemovalRecord): void {
  const key = removalIntervalKey(
    record.assetId,
    record.date,
    record.startTime,
    record.endTime,
  )
  const next = readRemovals().filter(
    (row) =>
      removalIntervalKey(row.assetId, row.date, row.startTime, row.endTime) !==
      key,
  )
  next.push(record)
  writeRemovals(next)
}

function forgetRemoval(
  assetId: string,
  date: string,
  startTime: string,
  endTime: string,
): void {
  const key = removalIntervalKey(assetId, date, startTime, endTime)
  writeRemovals(
    readRemovals().filter(
      (row) =>
        removalIntervalKey(row.assetId, row.date, row.startTime, row.endTime) !==
        key,
    ),
  )
}

function localLessonCreateOverrides(
  writes: readonly LocalWrite[],
  record: RemovalRecord,
): boolean {
  return writes.some(
    (write) =>
      dayKey(write.assetId, write.date) === dayKey(record.assetId, record.date) &&
      sameClock(write.slot.startTime, record.startTime) &&
      sameClock(write.slot.endTime, record.endTime) &&
      write.slot.occupancyKindKey === "lesson",
  )
}

function serverStillListsRemovedLesson(
  day: AdminDaySchedule,
  record: RemovalRecord,
): boolean {
  return day.slots.some(
    (slot) =>
      sameCivilDate(slot.date, record.date) &&
      sameClockInterval(slot, record.assetId, record.startTime, record.endTime) &&
      slot.occupancyKindKey === "lesson" &&
      isUnreservedAvailable(slot),
  )
}

function removalWritesFor(
  assetId: string,
  date: string,
  writes: readonly LocalWrite[],
): LocalWrite[] {
  return readRemovals()
    .filter((record) => dayKey(record.assetId, record.date) === dayKey(assetId, date))
    .filter((record) => !localLessonCreateOverrides(writes, record))
    .map((record) => ({
      assetId: record.assetId,
      date: record.date,
      slot: record.slot,
    }))
}

function syncRemovalRecords(
  serverDay: AdminDaySchedule,
  assetId: string,
  date: string,
  writes: readonly LocalWrite[],
): void {
  const next = readRemovals().filter((record) => {
    if (dayKey(record.assetId, record.date) !== dayKey(assetId, date)) {
      return true
    }
    if (localLessonCreateOverrides(writes, record)) {
      return false
    }
    return serverStillListsRemovedLesson(serverDay, record)
  })
  writeRemovals(next)
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
      .catch((error: unknown) => {
        if (cancelled) return
        toast.error(error instanceof Error ? error.message : i18n.t("rentals.teacherLessons.loadError"))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

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
      const localWrites = writesRef.current
      const merged = applyWrites(
        result,
        [...removalWritesFor(assetId, date, localWrites), ...localWrites],
        assetId,
        date,
      )
      writesRef.current = merged.writes
      syncRemovalRecords(result, assetId, date, localWrites)
      publishDay(merged.day, assetId, date)
      return merged.day
    } catch (error) {
      if (requestId === latestDayRequest.current) {
        if (!refreshingSameDay) {
          dayRef.current = null
          setDay(null)
          setDayStatus("error")
        }
        toast.error(error instanceof Error ? error.message : i18n.t("rentals.teacherLessons.loadError"))
      }
      return refreshingSameDay ? dayRef.current : null
    }
  }, [publishDay])

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
      forgetRemoval(assetId, date, slot.startTime, slot.endTime)
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
      rememberRemoval({ assetId, date, startTime, endTime, slot: opened })
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
