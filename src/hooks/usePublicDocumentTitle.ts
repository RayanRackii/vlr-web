import { useEffect } from "react"

import { DEFAULT_DOCUMENT_TITLE } from "@/hooks/useTenantDocumentMeta"

/** Sets the tab title of a public page to "<page> · Rolvix" and restores the previous one on unmount. */
export function usePublicDocumentTitle(pageTitle: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = `${pageTitle} · ${DEFAULT_DOCUMENT_TITLE}`
    return () => {
      document.title = previous
    }
  }, [pageTitle])
}
