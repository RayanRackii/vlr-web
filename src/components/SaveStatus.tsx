import { useTranslation } from "react-i18next"

export type SavedState = "idle" | "saving" | "saved" | "error"

export function SaveStatus({ state }: { state: SavedState }) {
  const { t } = useTranslation()
  if (state === "idle") return null
  return <span className={state === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"} role="status">{t(`common.saveStatus.${state}`)}</span>
}
