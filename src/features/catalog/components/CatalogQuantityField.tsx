import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import {
  CATALOG_CART_MAX_QUANTITY,
  CATALOG_CART_MIN_QUANTITY,
  clampCatalogQuantity,
} from "@/features/catalog/cart"

type CatalogQuantityFieldProps = {
  quantity: number
  productName: string
  onCommit: (quantity: number) => void
  className?: string
}

/**
 * The visible value is a draft while the field is being edited, including
 * when it is empty. The cart quantity changes only on blur.
 */
export function CatalogQuantityField({
  quantity,
  productName,
  onCommit,
  className,
}: CatalogQuantityFieldProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)

  useEffect(() => {
    setDraft(null)
  }, [quantity])

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={CATALOG_CART_MIN_QUANTITY}
      max={CATALOG_CART_MAX_QUANTITY}
      className={className}
      value={draft ?? String(quantity)}
      aria-label={t("tenantPortal.catalog.quantityFor", { name: productName })}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onBlur={() => {
        if (draft === null) {
          return
        }
        const trimmed = draft.trim()
        const parsed = trimmed.length === 0 ? Number.NaN : Number(trimmed)
        onCommit(clampCatalogQuantity(parsed))
        setDraft(null)
      }}
    />
  )
}
