import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { useBreadcrumbTitle } from "@/components/layout/useBreadcrumbTitle"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { usePedidos } from "../hooks/usePedidos"
import { formatCatalogDate } from "../schemas/catalogSchemas"

/**
 * Staff has no request detail endpoint: read only the fields in listProductRequests.
 * The response carries only customerId (no name/e-mail yet), so the customer shows "—", never the id.
 */
export function PedidoRequestDetailPage() {
  const { requestId } = useParams()
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const { requests, loading, errors, retry } = usePedidos(true)
  const request = requests.find(item => item.id === requestId)
  useBreadcrumbTitle(request?.description)
  return <Page width="form" header={{ title: t("pedidos.requestTitle"), description: request?.description }}>
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-5 text-card-foreground">
      {loading ? <p role="status">{t("pedidos.loading")}</p> : errors.length ? <div role="alert" className="space-y-3">{errors.map((error, index) => <p key={index}>{error}</p>)}<Button variant="outline" onClick={retry}>{t("catalog.retry")}</Button></div> : !request ? <p>{t("pedidos.notFound")}</p> : <dl className="grid gap-5 text-sm">
        {[
          ["description", request.description], ["quantityLabel", String(request.quantity)],
          ["status", t(`catalog.productRequestStatus.${request.status}`)], ["customer", "—"],
          ["note", request.note ?? "—"], ["createdAt", formatCatalogDate(request.createdAt, i18n.language, timeZone)],
        ].map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{t(`pedidos.${key}`)}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value}</dd></div>)}
        {request.files.length > 0 && <div><dt className="text-xs text-muted-foreground">{t("pedidos.files")}</dt><dd><ul className="mt-1 space-y-1">{request.files.map(file => <li key={file.id} className="break-words">{file.fileName}</li>)}</ul></dd></div>}
      </dl>}
    </section>
  </Page>
}
