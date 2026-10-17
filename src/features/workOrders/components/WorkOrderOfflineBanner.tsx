import { WifiOff } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

export function WorkOrderOfflineBanner() {
  const { t } = useTranslation()
  const online = useOnlineStatus()

  if (online) {
    return null
  }

  return (
    <div className="sticky top-0 z-30">
      <Alert variant="warning">
        <WifiOff aria-hidden="true" />
        <AlertTitle>{t("workOrders.offline.title")}</AlertTitle>
        <AlertDescription>{t("workOrders.offline.banner")}</AlertDescription>
      </Alert>
    </div>
  )
}
