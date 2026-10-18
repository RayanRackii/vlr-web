export function portalProductRequestRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number; pageCount: number } {
  if (total <= 0 || pageSize <= 0) {
    return { from: 0, to: 0, pageCount: 1 }
  }
  const pageCount = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return { from, to, pageCount }
}

/** Known statuses use i18n. Any other status stays as the API sent it. */
export function productRequestStatusLabel(
  status: string,
  translate: (key: string) => string,
): string {
  const key = `catalog.productRequestStatus.${status}`
  const label = translate(key)
  return label === key ? status : label
}
