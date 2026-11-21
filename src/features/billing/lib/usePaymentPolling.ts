import { useEffect, useRef, useState } from "react"

import { getMySubscription } from "@/features/billing/services/subscriptionService"

export const PAYMENT_POLL_INTERVAL_MS = 5000
export const PAYMENT_POLL_MAX_ATTEMPTS = 60

export type PaymentPollingState = "waiting" | "paid" | "timeout"

/**
 * Polls the subscription while a checkout is open. The payment webhook flips the status to `active`;
 * until then the status stays trialing/read_only/canceled. The caller mounts it fresh per checkout.
 * Stops on `active`, on timeout (about five
 * minutes) and when `enabled` turns false or the component unmounts.
 */
export function usePaymentPolling(enabled: boolean, onPaid: () => void): PaymentPollingState {
  const [state, setState] = useState<PaymentPollingState>("waiting")
  const onPaidRef = useRef(onPaid)

  useEffect(() => {
    onPaidRef.current = onPaid
  }, [onPaid])

  useEffect(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    let attempts = 0
    let inFlight = false

    const timer = setInterval(() => {
      if (inFlight) {
        return
      }
      inFlight = true
      attempts += 1
      void getMySubscription()
        .then((subscription) => {
          if (cancelled) {
            return
          }
          if (subscription.status === "active") {
            clearInterval(timer)
            setState("paid")
            onPaidRef.current()
          } else if (attempts >= PAYMENT_POLL_MAX_ATTEMPTS) {
            clearInterval(timer)
            setState("timeout")
          }
        })
        .catch(() => {
          if (!cancelled && attempts >= PAYMENT_POLL_MAX_ATTEMPTS) {
            clearInterval(timer)
            setState("timeout")
          }
        })
        .finally(() => {
          inFlight = false
        })
    }, PAYMENT_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled])

  return state
}
