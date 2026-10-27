import { createContext, useContext, useEffect, type Dispatch, type SetStateAction } from "react"
import { useLocation } from "react-router-dom"

export type BreadcrumbTitle = { pathname: string; value: string }

export const BreadcrumbTitleContext = createContext<{
  title?: BreadcrumbTitle
  setTitle: Dispatch<SetStateAction<BreadcrumbTitle | undefined>>
}>({ setTitle: () => undefined })

/** Optional outside the staff layout, so detail pages can also render independently. */
export function useBreadcrumbTitle(value: string | null | undefined) {
  const { pathname } = useLocation()
  const { setTitle } = useContext(BreadcrumbTitleContext)
  useEffect(() => {
    if (!value?.trim()) return
    const title = { pathname, value: value.trim() }
    setTitle(title)
    return () => setTitle((current) => current === title ? undefined : current)
  }, [pathname, setTitle, value])
}
