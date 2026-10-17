import { useSyncExternalStore } from "react"

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange)
  window.addEventListener("offline", onStoreChange)
  return () => {
    window.removeEventListener("online", onStoreChange)
    window.removeEventListener("offline", onStoreChange)
  }
}

function onlineSnapshot(): boolean {
  return navigator.onLine
}

function onlineServerSnapshot(): boolean {
  return true
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, onlineSnapshot, onlineServerSnapshot)
}
