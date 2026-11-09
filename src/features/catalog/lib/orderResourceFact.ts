export type RequirementRow = {
  rentalAssetId?: string | null
  durationMinutesPerUnit: number
  resourceQuantity: number
}

export type NamedAsset = {
  id: string
  name: string
  unitId: string
}

export type OrderResourceFact =
  | { kind: "none" }
  | { kind: "unset"; durationMinutesPerUnit: number; resourceQuantity: number }
  | {
    kind: "named"
    name: string
    rentalAssetId: string
    unitId: string | null
    durationMinutesPerUnit: number
    resourceQuantity: number
  }

export function orderResourceFact(
  requirements: readonly RequirementRow[],
  assets: readonly NamedAsset[],
): OrderResourceFact {
  const row = requirements.find((item) => (item.rentalAssetId?.trim().length ?? 0) > 0) ?? requirements[0]
  if (!row) {
    return { kind: "none" }
  }
  const assetId = row.rentalAssetId?.trim() ?? ""
  if (assetId.length === 0) {
    return {
      kind: "unset",
      durationMinutesPerUnit: row.durationMinutesPerUnit,
      resourceQuantity: row.resourceQuantity,
    }
  }
  const asset = assets.find((item) => item.id === assetId)
  return {
    kind: "named",
    name: asset?.name ?? assetId,
    rentalAssetId: assetId,
    unitId: asset?.unitId ?? null,
    durationMinutesPerUnit: row.durationMinutesPerUnit,
    resourceQuantity: row.resourceQuantity,
  }
}
