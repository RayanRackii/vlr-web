import { useState } from "react"

import type { GuideStep } from "./types"

const STORAGE_VERSION = "v1"

type GuideProgressState = {
  completedStepIds: string[]
  soundOn: boolean
}

const emptyState: GuideProgressState = { completedStepIds: [], soundOn: false }

function storageKey(userId: string, moduleKey: string): string {
  return `rolvix.guide.${STORAGE_VERSION}.${userId}.${moduleKey}`
}

function readState(key: string): GuideProgressState {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw) as Partial<GuideProgressState> | null
    if (!parsed || !Array.isArray(parsed.completedStepIds)) return emptyState
    return {
      completedStepIds: parsed.completedStepIds.filter((id): id is string => typeof id === "string"),
      soundOn: Boolean(parsed.soundOn),
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

export function useGuideProgress(userId: string | null | undefined, moduleKey: string, steps: readonly GuideStep[]) {
  const key = storageKey(userId ?? "anon", moduleKey)
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

  const points = steps.filter((step) => state.completedStepIds.includes(step.id)).reduce((sum, step) => sum + step.points, 0)

  return {
    completedStepIds: state.completedStepIds,
    completedCount: state.completedStepIds.length,
    totalSteps: steps.length,
    points,
    isStepDone,
    completeStep,
    reset,
    soundOn: state.soundOn,
    toggleSound,
  }
}
