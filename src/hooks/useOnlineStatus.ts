import { useSyncExternalStore } from "react"

import {
  isEffectivelyOnline,
  subscribeConnectivity,
} from "@/lib/connectivity"

function onlineServerSnapshot(): boolean {
  return true
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeConnectivity,
    isEffectivelyOnline,
    onlineServerSnapshot,
  )
}
