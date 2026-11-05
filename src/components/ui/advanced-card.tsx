import { useState, type ReactNode } from "react"
import { Settings2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type AdvancedCardProps = {
  children: ReactNode
  /** Override the default "Avançado" title. */
  title?: string
  defaultOpen?: boolean
  className?: string
}

/**
 * Card that tucks technical / rarely-used fields behind a gear icon and a
 * "Mostrar opções" / "Ocultar opções" toggle.
 */
export function AdvancedCard({ children, title, defaultOpen = false, className }: AdvancedCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" aria-hidden="true" />
          {title ?? t("fullPage.advanced.title")}
        </CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t("fullPage.advanced.hide") : t("fullPage.advanced.show")}
        </Button>
      </CardHeader>
      <CardContent hidden={!open}>{children}</CardContent>
    </Card>
  )
}
