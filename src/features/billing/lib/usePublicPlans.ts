import { useCallback, useEffect, useState } from "react"

import type { PublicPlan } from "@/features/billing/schemas/billingSchemas"
import { getPublicPlans } from "@/features/billing/services/billingService"

export type PublicPlansStatus = "loading" | "ready" | "error"

export function usePublicPlans(): {
  status: PublicPlansStatus
  plans: PublicPlan[]
  reload: () => void
} {
  const [state, setState] = useState<{ status: PublicPlansStatus; plans: PublicPlan[] }>({
    status: "loading",
    plans: [],
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void getPublicPlans()
      .then((plans) => {
        if (!cancelled) {
          setState({ status: "ready", plans })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", plans: [] })
        }
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => {
    setState({ status: "loading", plans: [] })
    setAttempt((value) => value + 1)
  }, [])

  return { ...state, reload }
}
