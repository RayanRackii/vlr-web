import { createContext, useContext } from "react"

export type ShellContextValue = {
  /** True when the staff shell renders the breadcrumb in its top bar. */
  breadcrumbInHeader: boolean
}

export const ShellContext = createContext<ShellContextValue>({
  breadcrumbInHeader: false,
})

export function useShellContext(): ShellContextValue {
  return useContext(ShellContext)
}
