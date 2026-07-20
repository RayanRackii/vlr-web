import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import {
  MASTER_CHAPTER,
  scrollToMasterChapter,
} from "@/features/landing/components/masterScrollNav"

export function LandingFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 md:flex-row md:items-start md:justify-between md:px-12 lg:px-24">
        <div>
          <p className="text-lg font-extrabold tracking-tighter">
            Rolvix<span className="text-primary">.</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {t("landing.footer.tagline")}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              scrollToMasterChapter(MASTER_CHAPTER.features)
            }}
          >
            {t("landing.header.nav.features")}
          </button>
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              scrollToMasterChapter(MASTER_CHAPTER.solutions)
            }}
          >
            {t("landing.header.nav.solutions")}
          </button>
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              scrollToMasterChapter(MASTER_CHAPTER.platform)
            }}
          >
            {t("landing.header.nav.platform")}
          </button>
          <a href="#pricing" className="hover:text-foreground">
            {t("landing.header.nav.pricing")}
          </a>
          <Link to="/login" className="hover:text-foreground">
            {t("landing.header.login")}
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-border px-6 pt-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-12 lg:px-24">
        <p>
          © {year} Rolvix. {t("landing.footer.rights")}
        </p>
        <p id="contact">
          {t("landing.footer.contactPrompt")}{" "}
          <a
            href="mailto:contato@rolvix.com"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("landing.cta.secondary")}
          </a>
        </p>
      </div>
    </footer>
  )
}
