import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import type { CatalogProductGalleryImage } from "@/features/catalog/lib/selectCatalogProductImages"
import { cn } from "@/lib/utils"

const SWIPE_THRESHOLD_PX = 40
const DOT_INDICATOR_MAX = 8

type CatalogProductImageGalleryProps = {
  images: CatalogProductGalleryImage[]
  alt: string
  className?: string
  frameClassName?: string
}

function stopParentNavigation(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}

export function CatalogProductImageGallery({
  images,
  alt,
  className,
  frameClassName,
}: CatalogProductImageGalleryProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [loadedIds, setLoadedIds] = useState<ReadonlySet<string>>(() => new Set())
  const pointerStartX = useRef<number | null>(null)

  const count = images.length
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1)
  const current = count === 0 ? undefined : images[safeIndex]
  const isCarousel = count >= 2

  if (current == null) {
    return null
  }

  const isBroken = failedIds.has(current.id)
  const isLoaded = loadedIds.has(current.id)

  function goTo(nextIndex: number) {
    if (count < 2) {
      return
    }
    const wrapped = ((nextIndex % count) + count) % count
    setIndex(wrapped)
  }

  function goPrevious() {
    goTo(safeIndex - 1)
  }

  function goNext() {
    goTo(safeIndex + 1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isCarousel) {
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      goPrevious()
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      goNext()
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!isCarousel || event.button !== 0) {
      return
    }
    pointerStartX.current = event.clientX
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!isCarousel || pointerStartX.current == null) {
      return
    }
    const delta = event.clientX - pointerStartX.current
    pointerStartX.current = null
    if (delta >= SWIPE_THRESHOLD_PX) {
      goPrevious()
    } else if (delta <= -SWIPE_THRESHOLD_PX) {
      goNext()
    }
  }

  function onPointerCancel() {
    pointerStartX.current = null
  }

  function markLoaded(id: string) {
    setLoadedIds((currentIds) => {
      if (currentIds.has(id)) {
        return currentIds
      }
      const next = new Set(currentIds)
      next.add(id)
      return next
    })
  }

  function markFailed(id: string) {
    setFailedIds((currentIds) => {
      if (currentIds.has(id)) {
        return currentIds
      }
      const next = new Set(currentIds)
      next.add(id)
      return next
    })
  }

  return (
    <div className={cn("relative", className)} onClick={stopParentNavigation}>
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          isCarousel && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          frameClassName,
        )}
        role={isCarousel ? "region" : undefined}
        aria-label={isCarousel ? alt : undefined}
        tabIndex={isCarousel ? 0 : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {isBroken ? (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-sm text-muted-foreground">
            {t("catalog.products.gallery.broken")}
          </div>
        ) : (
          <img
            src={current.url}
            alt={alt}
            draggable={false}
            className={cn(
              "h-full w-full object-contain object-center",
              isLoaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => {
              markLoaded(current.id)
            }}
            onError={() => {
              markFailed(current.id)
            }}
          />
        )}

        {isCarousel ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="pointer-events-auto absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-black/45 text-white shadow-md ring-1 ring-white/25 backdrop-blur-[2px] transition-colors hover:bg-black/60"
              aria-label={t("catalog.products.gallery.previous")}
              onPointerDown={stopParentNavigation}
              onClick={(event) => {
                stopParentNavigation(event)
                goPrevious()
              }}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="pointer-events-auto absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-black/45 text-white shadow-md ring-1 ring-white/25 backdrop-blur-[2px] transition-colors hover:bg-black/60"
              aria-label={t("catalog.products.gallery.next")}
              onPointerDown={stopParentNavigation}
              onClick={(event) => {
                stopParentNavigation(event)
                goNext()
              }}
            >
              <ChevronRight aria-hidden />
            </Button>
            {count <= DOT_INDICATOR_MAX ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
                <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 ring-1 ring-white/25 backdrop-blur-[2px]">
                  {images.map((image, imageIndex) => (
                    <button
                      key={image.id}
                      type="button"
                      className={cn(
                        "rounded-full transition-colors",
                        imageIndex === safeIndex
                          ? "size-2 bg-white"
                          : "size-1.5 bg-white/45 hover:bg-white/75",
                      )}
                      aria-label={t("catalog.products.gallery.imageOf", {
                        current: imageIndex + 1,
                        total: count,
                      })}
                      aria-current={imageIndex === safeIndex ? true : undefined}
                      onPointerDown={stopParentNavigation}
                      onClick={(event) => {
                        stopParentNavigation(event)
                        goTo(imageIndex)
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
                <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur-[2px]">
                  {t("catalog.products.gallery.imageOf", {
                    current: safeIndex + 1,
                    total: count,
                  })}
                </span>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
