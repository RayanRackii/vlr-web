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
  languageNativeNames,
  supportedLanguages,
  type SupportedLanguage,
} from "@/lib/i18n"

const languageOptions: readonly {
  code: SupportedLanguage
  shortLabel: string
}[] = [
  { code: "pt-BR", shortLabel: "PT" },
  { code: "en", shortLabel: "EN" },
  { code: "es", shortLabel: "ES" },
]

type LanguageSwitcherProps = {
  className?: string
  /** Keep PT/EN/ES visible below the sm breakpoint. */
  showShortLabel?: boolean
}

export function LanguageSwitcher({
  className,
  showShortLabel = false,
}: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation()

  const currentLanguage =
    supportedLanguages.find(
      (language) =>
        i18n.resolvedLanguage === language
        || i18n.language === language
        || i18n.language.startsWith(`${language}-`),
    ) ?? "pt-BR"

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
            className={className}
            aria-label={t("language.label")}
            title={t("language.label")}
          />
        }
      >
        <Languages />
        <span className={showShortLabel ? undefined : "hidden sm:inline"}>
          {currentShortLabel}
        </span>
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
            <span>{languageNativeNames[option.code]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
