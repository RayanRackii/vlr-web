import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"

/** Suspense fallback for the first load of a standalone (layout-less) lazy page. */
export function FullPageFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <PageContentSkeleton rows={3} className="w-full max-w-md" />
    </main>
  )
}
