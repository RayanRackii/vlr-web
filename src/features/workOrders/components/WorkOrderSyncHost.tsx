import { useEffect } from "react"

import { processSyncQueue } from "@/lib/offlineSync"

export function WorkOrderSyncHost() {
  useEffect(() => {
    const sync = () => {
      if (!navigator.onLine) {
        return
      }

      void processSyncQueue().catch((error: unknown) => {
        console.error("WorkOrderSyncHost processSyncQueue failed", error)
      })
    }

    window.addEventListener("online", sync)
    sync()

    return () => {
      window.removeEventListener("online", sync)
    }
  }, [])

  return null
}
