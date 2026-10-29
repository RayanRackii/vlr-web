import { useSyncExternalStore } from "react"

import {
  getCustomerLabel,
  subscribeCustomerLabel,
} from "@/features/tenantPortal/services/tenantPortalService"

export function useCustomerLabel(): string | null {
  return useSyncExternalStore(subscribeCustomerLabel, getCustomerLabel, () => null)
}
