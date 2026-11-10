export function resourceAssistantPath(rentalAssetId: string): string {
  return `/configuracoes/recursos/${encodeURIComponent(rentalAssetId)}/passos`
}

export function productAssistantPath(productId: string): string {
  return `/catalogo/produtos/${encodeURIComponent(productId)}/passos`
}
