import { useEffect } from "react"

import { api, isAxiosError } from "@/lib/api"
import {
  isEffectivelyOnline,
  noteTransportFailure,
  noteTransportSuccess,
  readBrowserOffline,
} from "@/lib/connectivity"
import { processSyncQueue } from "@/lib/offlineSync"

async function confirmConnectivity(): Promise<void> {
  if (readBrowserOffline() || isEffectivelyOnline()) {
    return
  }

  try {
    await api.get("/api/users/me")
    noteTransportSuccess()
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response) {
      noteTransportSuccess()
      return
    }

    noteTransportFailure()
    console.error("WorkOrderSyncHost connectivity probe failed", error)
  }
}

export function WorkOrderSyncHost() {
  useEffect(() => {
    const sync = () => {
      if (readBrowserOffline()) {
        return
      }

      void processSyncQueue()
        .catch((error: unknown) => {
          console.error("WorkOrderSyncHost processSyncQueue failed", error)
        })
        .finally(() => {
          void confirmConnectivity()
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
