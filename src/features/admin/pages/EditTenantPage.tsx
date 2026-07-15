import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function EditTenantPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          void navigate("/admin/dashboard")
        }}
      >
        <ArrowLeft className="size-4" />
        {t("admin.wizard.actions.backToDashboard")}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.edit.title")}</CardTitle>
          <CardDescription>
            {t("admin.edit.placeholder", { id: id ?? "" })}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
