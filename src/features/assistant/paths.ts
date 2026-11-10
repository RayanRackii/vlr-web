export function resourceAssistantPath(rentalAssetId: string): string {
  return `/configuracoes/recursos/${encodeURIComponent(rentalAssetId)}/passos`
}
