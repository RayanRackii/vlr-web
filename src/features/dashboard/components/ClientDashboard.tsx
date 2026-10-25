import { CalendarRange, TicketCheck } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/layout/PageHeader"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

export function ClientDashboard() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.client.title")}
        description={t("dashboard.client.description")}
      />

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
            <EmptyState
              size="sm"
              icon={TicketCheck}
              title={t("dashboard.client.tickets.empty")}
            />
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
            <EmptyState
              size="sm"
              icon={CalendarRange}
              title={t("dashboard.client.rentals.empty")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
