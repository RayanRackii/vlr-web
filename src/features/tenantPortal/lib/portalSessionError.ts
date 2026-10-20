import { toast } from "sonner"
import i18n from "@/lib/i18n"

export class PortalSessionExpiredError extends Error {
  constructor() {
    super(i18n.t("tenantPortal.sessionExpired"))
    this.name = "PortalSessionExpiredError"
  }
}

export function notifyPortalSessionExpired(): void {
  toast.error(i18n.t("tenantPortal.sessionExpired"), { id: "portal-session-expired" })
}
