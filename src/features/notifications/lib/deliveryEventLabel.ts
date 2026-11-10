const EVENT_LABEL_KEYS = new Map<string, string>([
  ["catalog.order.created", "catalog.events.orderCreated"],
  ["catalog.order.approved", "catalog.events.orderApproved"],
  ["catalog.order.preparing", "catalog.events.orderPreparing"],
  ["catalog.order.ready", "catalog.events.orderReady"],
  ["catalog.order.rejected", "catalog.events.orderRejected"],
  ["catalog.order.cancelled_by_supplier", "catalog.events.orderCancelledBySupplier"],
  ["catalog.order.cancelled_by_customer", "catalog.events.orderCancelledByCustomer"],
  ["rentals.reservation.pending_deposit", "rentals.events.reservationPendingDeposit"],
  ["rentals.reservation.confirmed", "rentals.events.reservationConfirmed"],
  ["rentals.reservation.canceled", "rentals.events.reservationCanceled"],
  ["rentals.reservation.completed", "rentals.events.reservationCompleted"],
  ["rentals.reservation.reminder", "rentals.events.reservationReminder"],
])

export const DELIVERY_EVENT_KEYS = [...EVENT_LABEL_KEYS.keys()]

type Translate = (key: string, options?: { defaultValue?: string }) => string

/** Label for a delivery eventKey. The module field is not part of the label. */
export function deliveryEventLabel(eventKey: string, translate: Translate): string {
  const key = EVENT_LABEL_KEYS.get(eventKey)
  if (!key) {
    return eventKey
  }
  return translate(key, { defaultValue: eventKey })
}
