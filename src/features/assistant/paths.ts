export function resourceAssistantPath(rentalAssetId: string): string {
  return `/configuracoes/recursos/${encodeURIComponent(rentalAssetId)}/cadastro`
}

export function productAssistantPath(productId: string): string {
  return `/catalogo/produtos/${encodeURIComponent(productId)}/cadastro`
}
