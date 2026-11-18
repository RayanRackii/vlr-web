import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ImagePlus, Package } from "lucide-react"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { CatalogProductGalleryImage } from "@/features/catalog/lib/selectCatalogProductImages"
import { cn } from "@/lib/utils"

type ProductViewGalleryProps = {
  images: readonly CatalogProductGalleryImage[]
  /** Product name: alt text and lightbox title. */
  name: string
  /** Where the "Adicionar fotos" button goes; omit to hide it (read-only users). Only used with no images. */
  addPhotosHref?: string
  className?: string
}

/**
 * Read-only product photos: the main image is shown whole (object-contain, never cropped) on a neutral
 * background; thumbnails appear only with more than one image; clicking the main image opens a lightbox.
 */
export function ProductViewGallery({ images, name, addPhotosHref, className }: ProductViewGalleryProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const current = images.find((image) => image.id === selectedId) ?? images[0]
  if (current == null) {
    return (
      <section
        aria-label={t("catalog.products.view.gallery.thumbnails")}
        className={cn("min-w-0", className)}
        data-testid="product-view-no-photo"
      >
        <div className="flex h-[180px] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-border bg-muted px-4 text-center aspect-[4/3] sm:h-auto sm:max-h-[320px]">
          <span
            className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"
            data-testid="product-view-no-photo-icon"
          >
            <Package className="size-7" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">{t("catalog.products.view.gallery.noPhoto")}</p>
          {addPhotosHref ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} to={addPhotosHref}>
              <ImagePlus data-icon="inline-start" aria-hidden="true" />
              {t("catalog.products.view.gallery.addPhotos")}
            </Link>
          ) : null}
        </div>
      </section>
    )
  }
  const failed = failedIds.has(current.id)
  const markFailed = (id: string) => setFailedIds((ids) => new Set(ids).add(id))

  return (
    <section aria-label={t("catalog.products.view.gallery.thumbnails")} className={cn("min-w-0 space-y-3", className)} data-testid="product-view-gallery">
      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        {failed ? (
          <div role="img" aria-label={t("catalog.products.gallery.broken")} className="flex aspect-[4/3] w-full items-center justify-center text-muted-foreground">
            <Package className="size-10" aria-hidden="true" />
          </div>
        ) : (
          <button
            type="button"
            className="block aspect-[4/3] w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
            aria-label={t("tenantPortal.catalog.enlargeImage", { name })}
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={current.url}
              alt={name}
              draggable={false}
              className="size-full object-contain object-center"
              data-testid="product-view-main-image"
              onError={() => markFailed(current.id)}
            />
          </button>
        )}
      </div>

      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={t("catalog.products.view.gallery.thumbnails")}>
          {images.map((image, index) => {
            const selected = image.id === current.id
            return (
              <li key={image.id} className="shrink-0">
                <button
                  type="button"
                  aria-label={t("catalog.products.view.gallery.photo", { current: index + 1, total: images.length })}
                  aria-current={selected ? true : undefined}
                  className={cn(
                    "block size-16 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-[72px]",
                    selected ? "border-primary ring-2 ring-primary" : "border-border hover:border-foreground/40",
                  )}
                  onClick={() => setSelectedId(image.id)}
                >
                  <img src={image.url} alt="" draggable={false} className="size-full object-cover" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-4xl">
          <DialogTitle className="sr-only">{t("catalog.products.view.gallery.lightbox", { name })}</DialogTitle>
          <img src={current.url} alt={name} className="max-h-[80vh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </section>
  )
}
