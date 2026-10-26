import { Check, CheckCheck, ImageOff, type LucideIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"

import { cn } from "@/lib/utils"
import {
  clampAspectRatio,
  clampCanvasWidthPercent,
  clampPercent,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_CANVAS_WIDTH_PERCENT,
  orderCanvasItemsForReading,
  snapMovePosition,
  snapResizeSize,
} from "@/features/rentals/components/layout/layoutCanvasModel"
import {
  portalPickAvailableClass,
  portalPickAvailableSelectedClass,
  portalPickOwnReservationClass,
  portalPickPendingClass,
  portalPickUnavailableClass,
} from "@/features/rentals/components/layout/portalPickStyles"

export type CanvasBoardItem = {
  key: string
  rentalAssetId: string
  label: string
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  zIndex: number
  available?: boolean
  selected?: boolean
  disabled?: boolean
  /** The signed-in customer already holds this slot — distinct from "unavailable". */
  ownReservation?: boolean
  /** Day is still loading. Neutral, not the unavailable treatment. */
  pending?: boolean
  /** Visible status for a space that cannot be booked. Not a hover-only tooltip. */
  detail?: string | null
  /** A solid label fixed to the bottom of a pick tile, clear of its visual art. */
  footer?: string | null
  artUrl?: string | null
  /** Optional semantic icon for tiles without visual art. */
  icon?: LucideIcon | null
  /** The template's configured color, shown on the placeholder icon so unpublished shapes still read apart from each other. */
  accentColor?: string | null
}

function CanvasTileArt({ artUrl, Icon, accentColor }: { artUrl?: string | null; Icon?: LucideIcon | null; accentColor?: string | null }) {
  const [failed, setFailed] = useState(false)
  if (artUrl && !failed) {
    return <img src={artUrl} alt="" onError={() => setFailed(true)} className="pointer-events-none absolute inset-0 size-full object-contain opacity-70" />
  }
  const Placeholder = Icon ?? ImageOff
  return (
    <Placeholder
      className="pointer-events-none size-5 text-muted-foreground/70"
      style={Icon && accentColor ? { color: accentColor } : undefined}
      aria-hidden
    />
  )
}

type TileDrag = {
  kind: "move" | "resize"
  rentalAssetId: string
  offsetX: number
  offsetY: number
  startX: number
  startY: number
  startW: number
  startH: number
}

type FrameDrag = {
  startX: number
  startY: number
  startWidthPx: number
  startHeightPx: number
  hostWidthPx: number
}

type LayoutCanvasBoardProps = {
  items: readonly CanvasBoardItem[]
  mode: "edit" | "pick"
  aspectRatio?: number
  canvasWidthPercent?: number
  className?: string
  onMove?: (rentalAssetId: string, xPercent: number, yPercent: number) => void
  onResize?: (
    rentalAssetId: string,
    widthPercent: number,
    heightPercent: number,
  ) => void
  onSelect?: (rentalAssetId: string) => void
  onRemove?: (rentalAssetId: string) => void
  onFrameResize?: (aspectRatio: number, widthPercent: number) => void
}

export function LayoutCanvasBoard({
  items,
  mode,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  canvasWidthPercent = DEFAULT_CANVAS_WIDTH_PERCENT,
  className,
  onMove,
  onResize,
  onSelect,
  onRemove,
  onFrameResize,
}: LayoutCanvasBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef(items)
  const tileDragRef = useRef<TileDrag | null>(null)
  const frameDragRef = useRef<FrameDrag | null>(null)
  const onMoveRef = useRef(onMove)
  const onResizeRef = useRef(onResize)
  const onFrameResizeRef = useRef(onFrameResize)

  itemsRef.current = items
  onMoveRef.current = onMove
  onResizeRef.current = onResize
  onFrameResizeRef.current = onFrameResize

  const renderedItems = useMemo(
    () => (mode === "pick" ? orderCanvasItemsForReading(items) : items),
    [items, mode],
  )

  function clientToPercent(clientX: number, clientY: number) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) {
      return { x: 0, y: 0 }
    }
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const tileDrag = tileDragRef.current
      if (tileDrag) {
        const point = clientToPercent(event.clientX, event.clientY)
        const siblings = itemsRef.current.filter(
          (item) => item.rentalAssetId !== tileDrag.rentalAssetId,
        )
        if (tileDrag.kind === "move") {
          const snapped = snapMovePosition(
            point.x - tileDrag.offsetX,
            point.y - tileDrag.offsetY,
            tileDrag.startW,
            tileDrag.startH,
            siblings,
          )
          onMoveRef.current?.(
            tileDrag.rentalAssetId,
            clampPercent(snapped.xPercent, tileDrag.startW),
            clampPercent(snapped.yPercent, tileDrag.startH),
          )
          return
        }
        const rawWidth = Math.min(100 - tileDrag.startX, Math.max(8, point.x - tileDrag.startX))
        const rawHeight = Math.min(100 - tileDrag.startY, Math.max(8, point.y - tileDrag.startY))
        const snappedSize = snapResizeSize(tileDrag.startX, tileDrag.startY, rawWidth, rawHeight, siblings)
        onResizeRef.current?.(
          tileDrag.rentalAssetId,
          Math.min(100 - tileDrag.startX, snappedSize.widthPercent),
          Math.min(100 - tileDrag.startY, snappedSize.heightPercent),
        )
        return
      }

      const frameDrag = frameDragRef.current
      if (!frameDrag || !onFrameResizeRef.current) {
        return
      }
      const deltaX = event.clientX - frameDrag.startX
      const deltaY = event.clientY - frameDrag.startY
      const nextWidthPx = Math.max(80, frameDrag.startWidthPx + deltaX)
      const nextHeightPx = Math.max(80, frameDrag.startHeightPx + deltaY)
      const nextAspect = clampAspectRatio(nextWidthPx / nextHeightPx)
      const nextWidthPercent = clampCanvasWidthPercent(
        (nextWidthPx / Math.max(1, frameDrag.hostWidthPx)) * 100,
      )
      onFrameResizeRef.current(nextAspect, nextWidthPercent)
    }

    function onPointerUp() {
      tileDragRef.current = null
      frameDragRef.current = null
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
    }
  }, [])

  function startTileDrag(
    event: ReactPointerEvent<HTMLElement>,
    item: CanvasBoardItem,
    kind: TileDrag["kind"],
  ) {
    if (mode !== "edit") {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const point = clientToPercent(event.clientX, event.clientY)
    tileDragRef.current = {
      kind,
      rentalAssetId: item.rentalAssetId,
      offsetX: point.x - item.xPercent,
      offsetY: point.y - item.yPercent,
      startX: item.xPercent,
      startY: item.yPercent,
      startW: item.widthPercent,
      startH: item.heightPercent,
    }
  }

  function startFrameDrag(event: ReactPointerEvent<HTMLElement>) {
    if (mode !== "edit" || !onFrameResize) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const board = boardRef.current?.getBoundingClientRect()
    const host = hostRef.current?.getBoundingClientRect()
    if (!board || !host) {
      return
    }
    frameDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidthPx: board.width,
      startHeightPx: board.height,
      hostWidthPx: host.width,
    }
  }

  return (
    <div ref={hostRef} className="min-w-0">
      <div
        className="relative"
        style={{ width: `${canvasWidthPercent}%` }}
      >
        <div
          ref={boardRef}
          className={cn(
            "w-full overflow-hidden rounded-xl border border-border bg-muted/30",
            mode === "pick"
              ? "grid grid-cols-2 gap-2 p-2 sm:relative sm:block sm:gap-0 sm:p-0 sm:aspect-[var(--canvas-ar)]"
              : "relative",
            className,
          )}
          style={
            mode === "pick"
              ? ({ "--canvas-ar": String(aspectRatio) } as CSSProperties)
              : { aspectRatio: String(aspectRatio) }
          }
        >
          {renderedItems.map((item) => {
            const picked = mode === "pick"
            const pending = picked && item.pending === true
            const unavailable = picked && item.disabled === true && !pending
            // No free window today, distinct from `disabled` (which also covers being busy
            // loading/locked): the tile still opens like the List view's equivalent row, but
            // reads as taken instead of green so the map doesn't look fully available.
            const bookedOut = picked && !unavailable && !pending && item.available === false
            const ownReservation = unavailable && item.ownReservation === true
            const selected = picked && item.selected === true && !unavailable && !pending
            const clickable = picked && !unavailable && !pending
            const accessibleName = item.detail
              ? `${item.label}. ${item.detail}`
              : item.label
            const tileStyle: CSSProperties = picked
              ? ({
                  "--tile-left": `${item.xPercent}%`,
                  "--tile-top": `${item.yPercent}%`,
                  "--tile-width": `${item.widthPercent}%`,
                  "--tile-height": `${item.heightPercent}%`,
                  zIndex: item.zIndex + 1,
                } as CSSProperties)
              : {
                  left: `${item.xPercent}%`,
                  top: `${item.yPercent}%`,
                  width: `${item.widthPercent}%`,
                  height: `${item.heightPercent}%`,
                  zIndex: item.zIndex + 1,
                }
            const tileBody = (
              <div
                key={item.key}
                role={picked ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={accessibleName}
                title={accessibleName}
                aria-pressed={picked ? item.selected : undefined}
                aria-busy={pending || undefined}
                aria-disabled={unavailable || pending || undefined}
                className={cn(
                  "flex min-w-0 items-center justify-center overflow-hidden rounded-lg border px-0.5 text-center text-xs font-medium leading-tight shadow-sm transition-colors select-none sm:px-1.5 sm:text-sm",
                  picked && "flex-col gap-0.5",
                  picked &&
                    "relative min-h-11 py-2 sm:absolute sm:min-h-0 sm:py-0 sm:left-[var(--tile-left)] sm:top-[var(--tile-top)] sm:w-[var(--tile-width)] sm:h-[var(--tile-height)]",
                  // The footer is pinned to the tile's bottom edge on sm:+ layouts; reserve
                  // that space so the detail/reason line never renders underneath it.
                  picked && item.footer && "sm:pb-6",
                  mode === "edit" &&
                    "absolute inset-0 cursor-grab border-primary/40 bg-primary/15 text-foreground active:cursor-grabbing",
                  mode === "edit" && item.selected && "ring-2 ring-primary ring-offset-2",
                  clickable && !selected && !ownReservation && !bookedOut && portalPickAvailableClass,
                  selected && portalPickAvailableSelectedClass,
                  pending && portalPickPendingClass,
                  (unavailable || bookedOut) && !ownReservation && portalPickUnavailableClass,
                  ownReservation && portalPickOwnReservationClass,
                )}
                style={mode === "edit" ? undefined : tileStyle}
                onPointerDown={(event) => {
                  startTileDrag(event, item, "move")
                }}
                onClick={() => {
                  if (clickable || mode === "edit") {
                    onSelect?.(item.rentalAssetId)
                  }
                }}
                onKeyDown={(event) => {
                  if (clickable && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault()
                    onSelect?.(item.rentalAssetId)
                  }
                }}
              >
                {(item.artUrl || item.icon) ? <CanvasTileArt key={item.artUrl ?? "placeholder"} artUrl={item.artUrl} Icon={item.icon} accentColor={item.accentColor} /> : null}
                {item.footer ? null : (
                  <span className="line-clamp-2 min-w-0 max-w-full break-normal hyphens-none px-0.5">
                    {item.label}
                  </span>
                )}
                {item.detail ? (
                  <span
                    title={item.detail}
                    className="block w-full max-w-full truncate px-0.5 text-xs font-semibold leading-tight"
                  >
                    {item.detail}
                  </span>
                ) : null}
                {selected ? (
                  <Check
                    aria-hidden
                    className="absolute top-1 right-1 size-3.5 shrink-0 text-primary sm:size-3"
                  />
                ) : null}
                {ownReservation ? (
                  <CheckCheck
                    aria-hidden
                    className="absolute top-1 right-1 size-3.5 shrink-0 text-primary sm:size-3"
                  />
                ) : null}
                {item.footer ? (
                  <span className="pointer-events-none min-w-0 self-stretch rounded-b-md sm:absolute sm:inset-x-0 sm:bottom-0 bg-background/95 px-1.5 py-1 text-center text-xs font-semibold leading-tight text-foreground shadow-[0_-1px_0_rgb(0_0_0_/_0.12)]">
                    <span className="line-clamp-2 break-normal hyphens-none sm:line-clamp-1" title={item.footer}>{item.footer}</span>
                  </span>
                ) : null}
                {mode === "edit" && onRemove ? (
                  <button
                    type="button"
                    aria-label="remove"
                    className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-sm bg-background/80 text-xs leading-none text-muted-foreground hover:text-destructive coarse:hidden"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onRemove(item.rentalAssetId)
                    }}
                  >
                    ×
                  </button>
                ) : null}
                {mode === "edit" ? (
                  <span
                    aria-hidden
                    className="absolute right-0.5 bottom-0.5 size-3 cursor-se-resize rounded-sm bg-primary/70 coarse:hidden"
                    onPointerDown={(event) => {
                      startTileDrag(event, item, "resize")
                    }}
                  />
                ) : null}
              </div>
            )

            if (mode !== "edit") {
              return tileBody
            }

            // overflow-hidden on the tile clips anything inside it, so the coarse
            // 44px remove/resize targets live outside the tile box entirely —
            // one above, one below — instead of competing for its corners.
            return (
              <div key={item.key} className="absolute" style={tileStyle}>
                {tileBody}
                {onRemove ? (
                  <button
                    type="button"
                    aria-label="remove"
                    className="absolute left-0 bottom-full z-10 mb-1 hidden size-11 items-center justify-center rounded-sm bg-background/80 text-sm leading-none text-muted-foreground hover:text-destructive coarse:flex"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onRemove(item.rentalAssetId)
                    }}
                  >
                    ×
                  </button>
                ) : null}
                <span
                  aria-hidden
                  className="absolute right-0 top-full z-10 mt-1 hidden size-11 cursor-se-resize rounded-sm bg-primary/70 coarse:flex"
                  onPointerDown={(event) => {
                    startTileDrag(event, item, "resize")
                  }}
                />
              </div>
            )
          })}
        </div>
        {mode === "edit" && onFrameResize ? (
          <button
            type="button"
            aria-label="resize-canvas"
            className="absolute -right-1 -bottom-1 z-20 size-5 cursor-se-resize rounded-sm border border-primary bg-background shadow-sm coarse:size-11"
            onPointerDown={startFrameDrag}
          />
        ) : null}
      </div>
    </div>
  )
}
