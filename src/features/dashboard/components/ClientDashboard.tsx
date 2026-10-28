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
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 [overflow-wrap:anywhere]">
      <PageHeader
        title={t("dashboard.client.title")}
        description={t("dashboard.client.description")}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TicketCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
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
              description={t("dashboard.clientEmptyHint")}
            />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarRange className="size-5 shrink-0 text-primary" aria-hidden="true" />
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
              description={t("dashboard.clientEmptyHint")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
