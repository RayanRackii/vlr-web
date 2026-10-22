import { useCallback, useState } from "react"

import type { SavedState } from "@/components/SaveStatus"

export function useSavedState() {
  const [saveState, setSaveState] = useState<SavedState>("idle")
  return {
    saveState,
    markSaving: useCallback(() => setSaveState("saving"), []),
    markSaved: useCallback(() => setSaveState("saved"), []),
    markError: useCallback(() => setSaveState("error"), []),
    markEdited: useCallback(() => setSaveState("idle"), []),
  }
}
