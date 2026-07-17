import { CalendarRange, TicketCheck } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ClientDashboard() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.client.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.client.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TicketCheck className="size-5 text-primary" />
              <CardTitle>{t("dashboard.client.tickets.title")}</CardTitle>
            </div>
            <CardDescription>
              {t("dashboard.client.tickets.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.client.tickets.empty")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarRange className="size-5 text-primary" />
              <CardTitle>{t("dashboard.client.rentals.title")}</CardTitle>
            </div>
            <CardDescription>
              {t("dashboard.client.rentals.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.client.rentals.empty")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
