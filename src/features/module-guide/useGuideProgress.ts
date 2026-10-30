import { useState } from "react"

import type { GuideStep } from "./types"

const STORAGE_VERSION = "v1"

type GuideProgressState = {
  completedStepIds: string[]
  soundOn: boolean
}

// Sound defaults ON; it only ever plays from a user action (completing a step or toggling it on).
const emptyState: GuideProgressState = { completedStepIds: [], soundOn: true }

function storageKey(tenantId: string | null | undefined, userId: string, moduleKey: string): string {
  return `rolvix.guide.${STORAGE_VERSION}.${tenantId ?? "no-tenant"}.${userId}.${moduleKey}`
}

function readState(key: string): GuideProgressState {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw) as Partial<GuideProgressState> | null
    if (!parsed || !Array.isArray(parsed.completedStepIds)) return emptyState
    return {
      completedStepIds: parsed.completedStepIds.filter((id): id is string => typeof id === "string"),
      // Absent flag → default ON (fresh user); an explicit stored `false` is honored.
      soundOn: parsed.soundOn === undefined ? true : Boolean(parsed.soundOn),
    }
  } catch {
    return emptyState
  }
}

function writeState(key: string, state: GuideProgressState): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // Storage unavailable (private browsing, quota, SSR) — progress stays in-memory for this render.
  }
}

export function useGuideProgress(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
  moduleKey: string,
  steps: readonly GuideStep[],
) {
  const key = storageKey(tenantId, userId ?? "anon", moduleKey)
  // `revision` only forces a re-render after a mutation; the state itself is read fresh from storage every render.
  const [, setRevision] = useState(0)
  const state = readState(key)

  function mutate(next: GuideProgressState) {
    writeState(key, next)
    setRevision((value) => value + 1)
  }

  function completeStep(stepId: string) {
    if (state.completedStepIds.includes(stepId)) return
    mutate({ ...state, completedStepIds: [...state.completedStepIds, stepId] })
  }

  function reset() {
    mutate({ ...emptyState, soundOn: state.soundOn })
  }

  function toggleSound() {
    mutate({ ...state, soundOn: !state.soundOn })
  }

  function isStepDone(stepId: string) {
    return state.completedStepIds.includes(stepId)
  }

  return {
    completedStepIds: state.completedStepIds,
    completedCount: steps.filter((step) => state.completedStepIds.includes(step.id)).length,
    totalSteps: steps.length,
    isStepDone,
    completeStep,
    reset,
    soundOn: state.soundOn,
    toggleSound,
  }
}
