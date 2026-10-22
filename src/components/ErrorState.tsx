import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

type ErrorStateProps = { message: string; onRetry: () => void; className?: string }

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation()
  return <div className={className ?? "rounded-lg border border-destructive/30 bg-destructive/5 p-4"} role="alert"><p className="text-sm text-destructive">{message}</p><Button className="mt-3" type="button" variant="outline" onClick={onRetry}>{t("common.retry")}</Button></div>
}
