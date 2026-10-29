import { useMemo, useSyncExternalStore } from "react"
import { NotificationBell } from "@/features/notifications-inbox/components/NotificationBell"
import { headerTouchTargetClassName } from "@/components/layout/headerTouchTarget"
import * as customerNotificationService from "../services/customerNotificationService"
import { getCustomerAccessToken, getCustomerSubdomain, isCustomerSignedInForTenant } from "../services/tenantPortalService"
import { subscribeCustomerSession } from "@/lib/customerSessionEvents"

function sessionSnapshot() {
  return JSON.stringify([getCustomerSubdomain(), getCustomerAccessToken()])
}

function customerRoute(_module: string, targetRoute: string) {
  return targetRoute
}

export function CustomerNotificationBell({ subdomain }: { subdomain: string }) {
  const session = useSyncExternalStore(subscribeCustomerSession, sessionSnapshot)
  const service = useMemo(() => {
    function assertCurrentSession() {
      if (sessionSnapshot() !== session || !isCustomerSignedInForTenant(subdomain)) {
        throw new DOMException("Customer session changed", "AbortError")
      }
    }
    async function inCurrentSession<T>(operation: () => Promise<T>): Promise<T> {
      assertCurrentSession()
      try {
        return await operation()
      } finally {
        // Storage in another tab can change before its storage event is delivered.
        assertCurrentSession()
      }
    }
    return {
      isCurrentSession: () => sessionSnapshot() === session && isCustomerSignedInForTenant(subdomain),
      getNotificationSummary: (signal?: AbortSignal) => inCurrentSession(() => customerNotificationService.getNotificationSummary(signal)),
      listNotifications: (...args: Parameters<typeof customerNotificationService.listNotifications>) => inCurrentSession(() => customerNotificationService.listNotifications(...args)),
      markIdsRead: (ids: string[]) => inCurrentSession(() => customerNotificationService.markIdsRead(ids)),
      markAllRead: () => inCurrentSession(() => customerNotificationService.markAllRead()),
    }
  }, [session, subdomain])
  if (!isCustomerSignedInForTenant(subdomain)) return null

  // A new session gets fresh state, aborts pending reads and closes any open panel.
  return <NotificationBell
    key={`${subdomain}:${session}`}
    enabled
    service={service}
    resolveRoute={customerRoute}
    resolveItemRoute={(item) => customerRoute(item.module, item.targetRoute)}
    isCurrentSession={service.isCurrentSession}
    className={headerTouchTargetClassName}
  />
}
