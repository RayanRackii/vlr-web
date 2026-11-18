import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { LibraryBig } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { Page } from "@/components/layout/Page"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import type { GlobalMaintenanceTemplate } from "@/features/pmoc/schemas/globalTemplateSchemas"
import { getGlobalTemplates } from "@/features/pmoc/services/pmocService"
import { isAxiosError } from "@/lib/api"
import { cn } from "@/lib/utils"

export function PmocLibraryPage() {
  const { t } = useTranslation()
  const { session } = useAuth()

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

  const previewPath = (template: GlobalMaintenanceTemplate) => `/pmoc/biblioteca/${template.id}`

  function renderModel(template: GlobalMaintenanceTemplate) {
    return (
      <div className="min-w-0">
        <Link to={previewPath(template)} className="text-sm font-medium text-foreground [overflow-wrap:anywhere] hover:underline">
          {template.name}
        </Link>
        {template.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
        ) : null}
      </div>
    )
  }

  function renderVersion(template: GlobalMaintenanceTemplate) {
    return <Badge variant="secondary">{t("pmoc.library.version", { version: template.version })}</Badge>
  }

  function renderCategory(template: GlobalMaintenanceTemplate) {
    return (
      <div className="min-w-0">
        <p className="text-sm [overflow-wrap:anywhere]">{template.targetEquipmentType}</p>
        <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{template.jurisdiction}</p>
      </div>
    )
  }

  function renderTasks(template: GlobalMaintenanceTemplate) {
    return t("pmoc.library.tasksCount", { count: template.tasks.length })
  }

  function renderAction(template: GlobalMaintenanceTemplate) {
    return (
      <Link to={previewPath(template)} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>
        {t("pmoc.preview.useModel")}
      </Link>
    )
  }

  const columns: DataListColumn<GlobalMaintenanceTemplate>[] = [
    { id: "model", header: t("pmoc.library.colModel"), cell: renderModel },
    { id: "version", header: t("pmoc.library.colVersion"), className: "whitespace-nowrap", cell: renderVersion },
    { id: "category", header: t("pmoc.library.colCategory"), cell: renderCategory },
    { id: "tasks", header: t("pmoc.library.colTasks"), className: "whitespace-nowrap tabular-nums", cell: renderTasks },
    { id: "actions", header: <span className="sr-only">{t("pmoc.library.colActions")}</span>, align: "end", cell: renderAction },
  ]

  const header = {
    title: t("pmoc.library.title"),
    description: t("pmoc.library.description"),
  }

  if (loadError !== null) {
    return <Page header={header} state="error" error={loadError} onRetry={() => { void loadLibrary() }}>{null}</Page>
  }

  return (
    <Page header={header}>
      <DataList<GlobalMaintenanceTemplate>
        state={isLoading ? "loading" : "ready"}
        label={t("pmoc.library.title")}
        loadingLabel={t("pmoc.library.loading")}
        loadingRows={4}
        columns={columns}
        rows={published}
        getRowId={(template) => template.id}
        empty={{ icon: LibraryBig, title: t("pmoc.library.empty") }}
        renderCard={(template) => (
          <>
            {renderModel(template)}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {renderVersion(template)}
              <span>{template.targetEquipmentType} · {template.jurisdiction}</span>
              <span>{renderTasks(template)}</span>
            </div>
            {renderAction(template)}
          </>
        )}
      />
    </Page>
  )
}
