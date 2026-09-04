import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { AdminModuleCatalogItem } from "@/features/admin/schemas/adminModuleCatalogSchemas"
import {
  listAdminModules,
  selectableCommercialModules,
} from "@/features/admin/services/adminModulesService"

export function useAdminModuleCatalog() {
  const { t } = useTranslation()
  const [items, setItems] = useState<AdminModuleCatalogItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const retry = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    void listAdminModules()
      .then((catalog) => {
        if (!cancelled) {
          setItems(catalog)
          setError(null)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setItems([])
          setError(
            caught instanceof Error
              ? caught.message
              : t("admin.modules.loadFailed"),
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey, t])

  const selectable = useMemo(
    () => selectableCommercialModules(items),
    [items],
  )

  return {
    items,
    selectable,
    error,
    isLoading,
    retry,
    modulesAvailable: selectable.length > 0,
  }
}
