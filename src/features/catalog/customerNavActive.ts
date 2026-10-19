import type { CustomerNavItem } from "@/features/tenantPortal/components/CustomerSidebar"

function splitNavTarget(to: string): { path: string; hash: string } {
  const hashIndex = to.indexOf("#")
  if (hashIndex < 0) {
    return { path: to, hash: "" }
  }
  return { path: to.slice(0, hashIndex), hash: to.slice(hashIndex) }
}

/** Signed-in shell highlight, including a hash link that shares a pathname. */
export function isCustomerNavItemActive(
  item: Pick<CustomerNavItem, "to" | "end">,
  items: readonly Pick<CustomerNavItem, "to">[],
  pathname: string,
  hash: string,
): boolean {
  const target = splitNavTarget(item.to)
  if (target.hash.length > 0) {
    return pathname === target.path && hash === target.hash
  }

  const hashSiblingOwnsPath = items.some((other) => {
    const otherTarget = splitNavTarget(other.to)
    return (
      otherTarget.hash.length > 0 &&
      otherTarget.hash === hash &&
      otherTarget.path === pathname
    )
  })
  if (hashSiblingOwnsPath && target.path === pathname) {
    return false
  }

  const longerSiblingOwnsPath = items.some((other) => {
    const otherTarget = splitNavTarget(other.to)
    if (otherTarget.hash.length > 0 || otherTarget.path === target.path) {
      return false
    }
    if (!otherTarget.path.startsWith(`${target.path}/`)) {
      return false
    }
    return (
      pathname === otherTarget.path ||
      pathname.startsWith(`${otherTarget.path}/`)
    )
  })
  if (longerSiblingOwnsPath) {
    return false
  }

  if (item.end) {
    return pathname === target.path
  }
  if (pathname === target.path) {
    return true
  }
  return target.path !== "/" && pathname.startsWith(`${target.path}/`)
}
