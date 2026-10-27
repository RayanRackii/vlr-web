import type { AppNavigationChildItem, AppNavigationItem } from "./navigation"
import type { NavigationTab } from "./navigationTabs"

export type NavigationMatch = {
  item: AppNavigationItem
  child?: AppNavigationChildItem
  tab?: NavigationTab
  isDetail: boolean
}

function normalizePath(path: string): string {
  return path.replace(/\/+$/, "") || "/"
}

/** Segment-aware, longest destination wins, including tabs outside the parent prefix. */
export function matchNavigationPath(
  items: readonly AppNavigationItem[],
  pathname: string,
): NavigationMatch | undefined {
  const path = normalizePath(pathname)
  let best: NavigationMatch | undefined
  let bestLength = -1

  function consider(item: AppNavigationItem, child?: AppNavigationChildItem, tab?: NavigationTab) {
    const destination = normalizePath((tab ?? child ?? item).to)
    if (path !== destination && !(destination !== "/" && path.startsWith(`${destination}/`))) return
    if (destination.length <= bestLength) return
    bestLength = destination.length
    best = { item, child, tab, isDetail: path !== destination }
  }

  for (const item of items) {
    if (item.children?.length) {
      for (const child of item.children) {
        if (child.tabs?.length) {
          for (const tab of child.tabs) consider(item, child, tab)
        } else consider(item, child)
      }
    } else if (item.tabs?.length) {
      for (const tab of item.tabs) consider(item, undefined, tab)
    } else consider(item)
  }

  return best
}
