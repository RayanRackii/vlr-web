import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CircleCheck } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { formatCatalogMoney } from "@/features/catalog/schemas/catalogSchemas"
import { cn } from "@/lib/utils"
import type { CadastroStep } from "./useCadastroStep"

type PanelProduct = {
  name: string
  price?: number | null
  currency: string
}

type Visibility = "Public" | "Restricted"

function priceLabel(product: PanelProduct, locale: string, fallback: string): string {
  return formatCatalogMoney(product.price ?? null, product.currency, locale) ?? fallback
}

/** Publicação step before publishing: what the customer will get, with a link back to each step. Built from the wizard's own data. */
export function ProductPublishSummary({ product, categoryNames, usesAgenda, resourceNames, visibility, go }: {
  product: PanelProduct
  categoryNames: readonly string[]
  usesAgenda: boolean
  resourceNames: readonly string[]
  visibility: Visibility
  go: (step: CadastroStep) => void
}) {
  const { t, i18n } = useTranslation()
  const rows: { field: string; step: CadastroStep; label: string; value: string }[] = [
    { field: "name", step: "dados", label: t("cadastro.review.name"), value: product.name },
    { field: "categories", step: "categorias", label: t("cadastro.review.categories"), value: categoryNames.length > 0 ? categoryNames.join(", ") : t("cadastro.review.noCategories") },
    { field: "price", step: "precos", label: t("cadastro.review.price"), value: priceLabel(product, i18n.language, t("cadastro.review.priceOnRequest")) },
    { field: "agenda", step: "agenda", label: t("cadastro.review.agenda"), value: usesAgenda ? (resourceNames.length > 0 ? resourceNames.join(", ") : t("cadastro.review.agendaLinked")) : t("cadastro.review.noAgenda") },
    { field: "visibility", step: "regras", label: t("cadastro.review.visibility"), value: t(visibility === "Restricted" ? "cadastro.review.visibilityRestricted" : "cadastro.review.visibilityPublic") },
  ]
  return (
    <section aria-label={t("cadastro.review.title")} className="space-y-2">
      <h3 className="text-sm font-semibold">{t("cadastro.review.title")}</h3>
      <dl className="divide-y rounded-lg border">
        {rows.map((row) => (
          <div key={row.field} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="break-words text-sm font-medium" data-testid={`review-${row.field}`}>{row.value}</dd>
            </div>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" aria-label={t("cadastro.review.editField", { field: row.label })} onClick={() => go(row.step)}>
              {t("cadastro.review.edit")}
            </Button>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Shown in place of the Publicação step after a successful publish. */
export function ProductPublishSuccess({ product, visibility, editorPath }: {
  product: PanelProduct
  visibility: Visibility
  editorPath: string
}) {
  const { t, i18n } = useTranslation()
  return (
    <section aria-label={t("cadastro.published.title")} className="space-y-5" data-testid="product-publish-success">
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold" role="status">{t("cadastro.published.title")}</h3>
          <p className="break-words text-sm font-medium">{product.name} · {priceLabel(product, i18n.language, t("cadastro.published.priceOnRequest"))}</p>
          <p className="text-sm text-muted-foreground">{t(visibility === "Restricted" ? "cadastro.published.visibilityRestricted" : "cadastro.published.visibilityPublic")}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/catalogo/produtos" className={cn(buttonVariants({ variant: "primary" }), "min-h-11")}>{t("cadastro.published.viewList")}</Link>
        <Link to="/catalogo/produtos/cadastro" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{t("cadastro.published.createAnother")}</Link>
        <Link to={editorPath} className={cn(buttonVariants({ variant: "ghost" }), "min-h-11")}>{t("cadastro.published.keepEditing")}</Link>
      </div>
    </section>
  )
}
