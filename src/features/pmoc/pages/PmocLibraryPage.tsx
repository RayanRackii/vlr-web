import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronRight, LibraryBig } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import type { GlobalMaintenanceTemplate } from "@/features/pmoc/schemas/globalTemplateSchemas"
import { getGlobalTemplates } from "@/features/pmoc/services/pmocService"
import { isAxiosError } from "@/lib/api"

export function PmocLibraryPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<GlobalMaintenanceTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadLibrary = useCallback(async () => {
    if (!session) {
      setLoadError(t("pmoc.library.errors.unauthorized"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getGlobalTemplates()
      setTemplates(data.filter((template) => template.status === "Published"))
    } catch (error: unknown) {
      console.error("PmocLibraryPage loadLibrary failed", error)
      if (isAxiosError(error)) {
        console.error("PmocLibraryPage loadLibrary response", error.response?.data)
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.library.errors.loadFailed")
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [session, t])

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  const published = useMemo(
    () =>
      [...templates].sort((left, right) => left.name.localeCompare(right.name)),
    [templates],
  )

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("pmoc.library.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("pmoc.library.description")}
        </p>
      </div>

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {isLoading ? <PageContentSkeleton rows={4} /> : null}

      {!isLoading && loadError === null && published.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LibraryBig className="size-6" aria-hidden />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("pmoc.library.empty")}
          </p>
        </div>
      ) : null}

      {!isLoading && published.length > 0 ? (
        <ul className="space-y-2">
          {published.map((template) => (
            <li key={template.id}>
              <Button
                type="button"
                variant="outline"
                className="group h-auto w-full flex-col items-start gap-2 whitespace-normal px-4 py-3 text-left"
                onClick={() => {
                  void navigate(`/pmoc/biblioteca/${template.id}`)
                }}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="min-w-0 font-medium">{template.name}</span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant="secondary">
                    {t("pmoc.library.version", { version: template.version })}
                  </Badge>
                  <span className="min-w-0">
                    {t("pmoc.templates.meta", {
                      jurisdiction: template.jurisdiction,
                      equipment: template.targetEquipmentType,
                      tasks: template.tasks.length,
                    })}
                  </span>
                </span>
                {template.description ? (
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {template.description}
                  </span>
                ) : null}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
