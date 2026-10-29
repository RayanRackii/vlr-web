import { useState } from "react"

export function PortalCartCount({ count }: { count: number }) {
  const [previous, setPrevious] = useState({ count, increased: false })
  if (count !== previous.count) {
    setPrevious({ count, increased: count > previous.count })
  }

  if (count <= 0) return null

  return (
    <span key={count} aria-hidden="true"
      className={`portal-catalog-cart-count${previous.increased ? " portal-cart-count-pulse" : ""}`}>
      {count}
    </span>
  )
}
