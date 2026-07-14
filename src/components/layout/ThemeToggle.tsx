import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("theme.toggle")}
        disabled
      >
        <Sun />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={t("theme.toggle")}
      onClick={() => {
        setTheme(isDark ? "light" : "dark")
      }}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
