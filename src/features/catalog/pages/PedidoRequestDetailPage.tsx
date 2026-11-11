import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useBreadcrumbTitle } from "@/components/layout/useBreadcrumbTitle"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { usePedidos } from "../hooks/usePedidos"
import { formatCatalogDate } from "../schemas/catalogSchemas"
import "./pedidos.css"

/** Staff has no request detail endpoint: read only the fields in listProductRequests. */
export function PedidoRequestDetailPage() {
  const { requestId } = useParams()
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const { requests, loading, errors, retry } = usePedidos(true)
  const request = requests.find(item => item.id === requestId)
  useBreadcrumbTitle(request?.description)
  return <div className="pedidos-page mx-auto min-w-0 space-y-5">
    <header className="space-y-1"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("pedidos.requestTitle")}</h1>
      {request && <p className="text-sm text-muted-foreground">{request.description}</p>}
    </header>
    <section className="pedidos-card p-5">
      {loading ? <p role="status">{t("pedidos.loading")}</p> : errors.length ? <div role="alert" className="space-y-3">{errors.map((error, index) => <p key={index}>{error}</p>)}<Button variant="outline" onClick={retry}>{t("catalog.retry")}</Button></div> : !request ? <p>{t("pedidos.notFound")}</p> : <dl className="grid gap-5 text-sm">
        {[
          ["description", request.description], ["quantityLabel", String(request.quantity)],
          ["status", t(`catalog.productRequestStatus.${request.status}`)], ["customer", request.customerId],
          ["note", request.note ?? "—"], ["createdAt", formatCatalogDate(request.createdAt, i18n.language, timeZone)],
        ].map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{t(`pedidos.${key}`)}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value}</dd></div>)}
        {request.files.length > 0 && <div><dt className="text-xs text-muted-foreground">{t("pedidos.files")}</dt><dd><ul className="mt-1 space-y-1">{request.files.map(file => <li key={file.id} className="break-words">{file.fileName}</li>)}</ul></dd></div>}
      </dl>}
    </section>
  </div>
}
