import { useMemo, useState, type ReactNode } from "react"

import { BreadcrumbTitleContext, type BreadcrumbTitle } from "./useBreadcrumbTitle"

export function BreadcrumbTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<BreadcrumbTitle>()
  const value = useMemo(() => ({ title, setTitle }), [title])
  return <BreadcrumbTitleContext value={value}>{children}</BreadcrumbTitleContext>
}
