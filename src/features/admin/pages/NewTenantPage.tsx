import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { TenantOnboardingWizard } from "@/features/admin/components/TenantOnboardingWizard"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui/button"

export function NewTenantPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
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

          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <TenantOnboardingWizard />
      </main>
    </div>
  )
}
