import { Languages } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  supportedLanguages,
  type SupportedLanguage,
} from "@/lib/i18n"

const languageOptions: readonly {
  code: SupportedLanguage
  labelKey: "language.ptBR" | "language.en" | "language.es"
  shortLabel: string
}[] = [
  { code: "pt-BR", labelKey: "language.ptBR", shortLabel: "PT" },
  { code: "en", labelKey: "language.en", shortLabel: "EN" },
  { code: "es", labelKey: "language.es", shortLabel: "ES" },
]

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  const currentLanguage =
    supportedLanguages.find((language) => i18n.language.startsWith(language)) ??
    "pt-BR"

  const currentShortLabel =
    languageOptions.find((option) => option.code === currentLanguage)
      ?.shortLabel ?? "PT"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("language.label")}
          />
        }
      >
        <Languages />
        <span className="hidden sm:inline">{currentShortLabel}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        </DropdownMenuGroup>

        {languageOptions.map((option) => (
          <DropdownMenuItem
            key={option.code}
            onClick={() => {
              void i18n.changeLanguage(option.code)
            }}
          >
            <span className="w-8 font-medium">{option.shortLabel}</span>
            <span>{t(option.labelKey)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
