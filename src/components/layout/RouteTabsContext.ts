import { createContext, useContext } from "react"

/** True below `FeatureRouteTabs`: headers there are section headers, not the page h1. */
export const RouteTabsContext = createContext(false)

export function useInRouteTabs(): boolean {
  return useContext(RouteTabsContext)
}
