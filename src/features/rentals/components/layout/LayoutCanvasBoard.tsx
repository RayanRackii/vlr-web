import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import {
  clampAspectRatio,
  clampCanvasWidthPercent,
  clampPercent,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_CANVAS_WIDTH_PERCENT,
} from "@/features/rentals/components/layout/layoutCanvasModel"

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

type FrameAxis = "south" | "east" | "corner"

type FrameDrag = {
  axis: FrameAxis
  startX: number
  startY: number
  startWidthPx: number
  startHeightPx: number
  startAspectRatio: number
  startWidthPercent: number
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
  const { t } = useTranslation()
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
        if (tileDrag.kind === "move") {
          onMoveRef.current?.(
            tileDrag.rentalAssetId,
            clampPercent(point.x - tileDrag.offsetX, tileDrag.startW),
            clampPercent(point.y - tileDrag.offsetY, tileDrag.startH),
          )
          return
        }
        onResizeRef.current?.(
          tileDrag.rentalAssetId,
          Math.min(100 - tileDrag.startX, Math.max(8, point.x - tileDrag.startX)),
          Math.min(100 - tileDrag.startY, Math.max(8, point.y - tileDrag.startY)),
        )
        return
      }

      const frameDrag = frameDragRef.current
      if (!frameDrag || !onFrameResizeRef.current) {
        return
      }
      const deltaX = event.clientX - frameDrag.startX
      const deltaY = event.clientY - frameDrag.startY
      if (frameDrag.axis === "south") {
        const nextHeightPx = Math.max(80, frameDrag.startHeightPx + deltaY)
        const nextAspect = clampAspectRatio(
          frameDrag.startWidthPx / nextHeightPx,
        )
        onFrameResizeRef.current(nextAspect, frameDrag.startWidthPercent)
        return
      }
      if (frameDrag.axis === "east") {
        const nextWidthPx = Math.max(80, frameDrag.startWidthPx + deltaX)
        const nextWidthPercent = clampCanvasWidthPercent(
          (nextWidthPx / Math.max(1, frameDrag.hostWidthPx)) * 100,
        )
        onFrameResizeRef.current(frameDrag.startAspectRatio, nextWidthPercent)
        return
      }
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

  function startFrameDrag(
    event: ReactPointerEvent<HTMLElement>,
    axis: FrameAxis,
  ) {
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
      axis,
      startX: event.clientX,
      startY: event.clientY,
      startWidthPx: board.width,
      startHeightPx: board.height,
      startAspectRatio: aspectRatio,
      startWidthPercent: canvasWidthPercent,
      hostWidthPx: host.width,
    }
  }

  return (
    <div ref={hostRef} className="min-w-0">
      <div
        className={cn(
          "relative",
          // Tailwind default `md` (768px): phones full-width; tablet+ honor persisted width.
          mode === "pick" && "w-full md:w-[var(--layout-canvas-width)]",
        )}
        style={
          mode === "pick"
            ? ({
                "--layout-canvas-width": `${canvasWidthPercent}%`,
              } as CSSProperties)
            : { width: `${canvasWidthPercent}%` }
        }
      >
        <div
          ref={boardRef}
          className={cn(
            "relative w-full overflow-hidden rounded-xl border border-border bg-muted/30",
            className,
          )}
          style={{ aspectRatio: String(aspectRatio) }}
        >
          {items.map((item) => {
            const unavailable = mode === "pick" && item.disabled
            const clickable = mode === "pick" && !unavailable
            return (
              <div
                key={item.key}
                role={mode === "pick" ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-pressed={mode === "pick" ? item.selected : undefined}
                aria-disabled={unavailable || undefined}
                className={cn(
                  "absolute flex items-center justify-center rounded-lg border px-1.5 text-center text-xs font-medium leading-tight shadow-sm transition-colors select-none sm:text-sm",
                  mode === "edit" &&
                    "cursor-grab border-primary/40 bg-primary/15 text-foreground active:cursor-grabbing",
                  clickable &&
                    !item.selected &&
                    "cursor-pointer border-emerald-500/70 bg-emerald-100 text-emerald-950 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-50",
                  item.selected &&
                    "border-primary bg-primary/20 text-foreground ring-2 ring-primary",
                  unavailable &&
                    "cursor-not-allowed border-border bg-muted text-muted-foreground",
                )}
                style={{
                  left: `${item.xPercent}%`,
                  top: `${item.yPercent}%`,
                  width: `${item.widthPercent}%`,
                  height: `${item.heightPercent}%`,
                  zIndex: item.zIndex + 1,
                }}
                onPointerDown={(event) => {
                  startTileDrag(event, item, "move")
                }}
                onClick={() => {
                  if (clickable) {
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
                <span className="line-clamp-3 break-words px-3">{item.label}</span>
                {mode === "edit" && onRemove ? (
                  <button
                    type="button"
                    aria-label="remove"
                    className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-sm bg-background/80 text-xs leading-none text-muted-foreground hover:text-destructive"
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
                    className="absolute right-0.5 bottom-0.5 size-3 cursor-se-resize rounded-sm bg-primary/70"
                    onPointerDown={(event) => {
                      startTileDrag(event, item, "resize")
                    }}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
        {mode === "edit" && onFrameResize ? (
          <>
            <button
              type="button"
              aria-label={t("rentals.layout.resizeHandleSouth")}
              data-layout-resize="south"
              className="absolute bottom-0 left-1/2 z-20 size-5 -translate-x-1/2 translate-y-1/2 cursor-s-resize rounded-sm border border-primary bg-background shadow-sm"
              onPointerDown={(event) => {
                startFrameDrag(event, "south")
              }}
            />
            <button
              type="button"
              aria-label={t("rentals.layout.resizeHandleEast")}
              data-layout-resize="east"
              className="absolute top-1/2 right-0 z-20 size-5 translate-x-1/2 -translate-y-1/2 cursor-e-resize rounded-sm border border-primary bg-background shadow-sm"
              onPointerDown={(event) => {
                startFrameDrag(event, "east")
              }}
            />
            <button
              type="button"
              aria-label={t("rentals.layout.resizeHandleCorner")}
              data-layout-resize="corner"
              className="absolute -right-1 -bottom-1 z-20 size-5 cursor-se-resize rounded-sm border border-primary bg-background shadow-sm"
              onPointerDown={(event) => {
                startFrameDrag(event, "corner")
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
