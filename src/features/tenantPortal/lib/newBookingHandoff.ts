type BookingHandoffSelection = {
  rentalAssetId: string
  startTime: string
  endTime: string
  quantity: number
}

/** Preserves the complete selected window while returning to the legacy flow. */
export function newBookingHandoffSearchParams(
  current: URLSearchParams,
  date: string,
  selection: BookingHandoffSelection,
): URLSearchParams {
  const params = new URLSearchParams(current)
  params.set("legacyBooking", "1")
  params.set("date", date)
  params.set("time", selection.startTime.slice(0, 5))
  params.set("endTime", selection.endTime.slice(0, 5))
  params.set("rentalAssetId", selection.rentalAssetId)
  params.set("quantity", String(selection.quantity))
  return params
}
