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
  /** Lesson slot id that was removed. A later lesson at the same time is a new one. */
  lessonId?: string
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
  if (
    "lessonId" in value &&
    value.lessonId !== undefined &&
    typeof value.lessonId !== "string"
  ) {
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

function unreservedLessonAt(
  day: AdminDaySchedule,
  assetId: string,
  startTime: string,
  endTime: string,
): LessonSlot | undefined {
  return day.slots.find(
    (slot) =>
      sameClockInterval(slot, assetId, startTime, endTime) &&
      slot.occupancyKindKey === "lesson" &&
      isUnreservedAvailable(slot),
  )
}

function serverStillListsRemovedLesson(
  day: AdminDaySchedule,
  record: RemovalRecord,
): boolean {
  const lesson = unreservedLessonAt(
    day,
    record.assetId,
    record.startTime,
    record.endTime,
  )
  if (!lesson || !sameCivilDate(lesson.date, record.date)) {
    return false
  }
  if (record.lessonId !== undefined && lesson.id !== record.lessonId) {
    return false
  }
  return true
}

/** A new lesson id at the removed time means the lesson was recreated. */
function forgetRecreatedLessons(
  day: AdminDaySchedule,
  assetId: string,
  date: string,
): void {
  for (const record of readRemovals()) {
    if (dayKey(record.assetId, record.date) !== dayKey(assetId, date)) {
      continue
    }
    if (record.lessonId === undefined) {
      continue
    }
    const lesson = unreservedLessonAt(
      day,
      record.assetId,
      record.startTime,
      record.endTime,
    )
    if (lesson && lesson.id !== record.lessonId) {
      forgetRemoval(record.assetId, record.date, record.startTime, record.endTime)
    }
  }
}

/**
 * The open-slot write from a removal must not cover a lesson that is no
 * longer the one this tab removed.
 */
function dropStaleOpenWrites(
  writes: readonly LocalWrite[],
  day: AdminDaySchedule,
  assetId: string,
  date: string,
): LocalWrite[] {
  const removedKeys = new Set(
    readRemovals()
      .filter((record) => dayKey(record.assetId, record.date) === dayKey(assetId, date))
      .map((record) =>
        removalIntervalKey(
          record.assetId,
          record.date,
          record.startTime,
          record.endTime,
        ),
      ),
  )
  return writes.filter((write) => {
    if (dayKey(write.assetId, write.date) !== dayKey(assetId, date)) {
      return true
    }
    if (write.slot.occupancyKindKey !== "open") {
      return true
    }
    const lesson = unreservedLessonAt(
      day,
      write.assetId,
      write.slot.startTime,
      write.slot.endTime,
    )
    if (!lesson) {
      return true
    }
    return removedKeys.has(
      removalIntervalKey(
        write.assetId,
        write.date,
        write.slot.startTime,
        write.slot.endTime,
      ),
    )
  })
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
      forgetRecreatedLessons(result, assetId, date)
      writesRef.current = dropStaleOpenWrites(writesRef.current, result, assetId, date)
      const localWrites = writesRef.current
      syncRemovalRecords(result, assetId, date, localWrites)
      const merged = applyWrites(
        result,
        [...removalWritesFor(assetId, date, localWrites), ...localWrites],
        assetId,
        date,
      )
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

  const remove = useCallback(async (assetId: string, date: string, startTime: string, endTime: string, lessonId: string) => {
    setBusy(true)
    try {
      const opened = await removeTeacherLesson({ rentalAssetId: assetId, date, startTime, endTime })
      if (opened.occupancyKindKey !== "open" || !matchesRequestedInterval(opened, assetId, date, startTime, endTime)) {
        throw new Error(t("rentals.teacherLessons.changeError"))
      }
      rememberRemoval({ assetId, date, startTime, endTime, lessonId, slot: opened })
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
