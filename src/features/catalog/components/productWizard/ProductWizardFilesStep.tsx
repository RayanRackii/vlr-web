import { useStepSubmit } from "@/features/assistant/stepSubmit"
import { ProductFilesManager, type ProductFilesReload } from "@/features/catalog/components/ProductFilesManager"
import type { CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"

/** Optional "Fotos e arquivos" step. Uploads and deletions save immediately, so there is nothing to submit. */
export function ProductWizardFilesStep({ product, canManage, onReload, onBusyChange }: {
  product: Pick<CatalogProduct, "id" | "name" | "files">
  canManage: boolean
  onReload: ProductFilesReload
  onBusyChange?: (busy: boolean) => void
}) {
  useStepSubmit(async () => true)
  return <ProductFilesManager productId={product.id} productName={product.name} files={product.files} canManage={canManage} onReload={onReload} onBusyChange={onBusyChange} />
}
