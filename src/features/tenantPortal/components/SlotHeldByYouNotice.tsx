import { useTranslation } from "react-i18next"

import { CUSTOMER_MY_RESERVATIONS_HASH } from "@/features/catalog/customerNav"

type SlotHeldByYouNoticeProps = {
  href?: string
}

/** Toast body when this customer already holds the slot, including from another tab. */
export function SlotHeldByYouNotice({
  href = CUSTOMER_MY_RESERVATIONS_HASH,
}: SlotHeldByYouNoticeProps) {
  const { t } = useTranslation()

  return (
    <span>
      {t("tenantPortal.agenda.slotHeldByYou")}{" "}
      <a href={href} className="font-medium underline">
        {t("tenantPortal.agenda.myReservations")}
      </a>
      .
    </span>
  )
}
