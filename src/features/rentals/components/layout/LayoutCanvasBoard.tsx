import { useRef, useState, type PointerEvent } from "react"

import { cn } from "@/lib/utils"
import { clampPercent } from "@/features/rentals/components/layout/layoutCanvasModel"

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

type DragKind = "move" | "resize"

type LayoutCanvasBoardProps = {
  items: readonly CanvasBoardItem[]
  mode: "edit" | "pick"
  className?: string
  onMove?: (rentalAssetId: string, xPercent: number, yPercent: number) => void
  onResize?: (
    rentalAssetId: string,
    widthPercent: number,
    heightPercent: number,
  ) => void
  onSelect?: (rentalAssetId: string) => void
  onRemove?: (rentalAssetId: string) => void
}

export function LayoutCanvasBoard({
  items,
  mode,
  className,
  onMove,
  onResize,
  onSelect,
  onRemove,
}: LayoutCanvasBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<{
    rentalAssetId: string
    kind: DragKind
  } | null>(null)

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

  function handlePointerDown(
    event: PointerEvent<HTMLElement>,
    item: CanvasBoardItem,
    kind: DragKind,
  ) {
    if (mode !== "edit") {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = clientToPercent(event.clientX, event.clientY)
    dragOffsetRef.current = {
      x: point.x - item.xPercent,
      y: point.y - item.yPercent,
    }
    setDragging({ rentalAssetId: item.rentalAssetId, kind })
  }

  function handlePointerMove(
    event: PointerEvent<HTMLElement>,
    item: CanvasBoardItem,
  ) {
    if (!dragging || dragging.rentalAssetId !== item.rentalAssetId) {
      return
    }
    const point = clientToPercent(event.clientX, event.clientY)
    if (dragging.kind === "move") {
      onMove?.(
        item.rentalAssetId,
        clampPercent(point.x - dragOffsetRef.current.x, item.widthPercent),
        clampPercent(point.y - dragOffsetRef.current.y, item.heightPercent),
      )
      return
    }
    onResize?.(
      item.rentalAssetId,
      Math.min(
        100 - item.xPercent,
        Math.max(12, point.x - item.xPercent),
      ),
      Math.min(
        100 - item.yPercent,
        Math.max(12, point.y - item.yPercent),
      ),
    )
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(null)
  }

  return (
    <div
      ref={boardRef}
      className={cn(
        "relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-muted/30",
        className,
      )}
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
              handlePointerDown(event, item, "move")
            }}
            onPointerMove={(event) => {
              handlePointerMove(event, item)
            }}
            onPointerUp={handlePointerUp}
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
                  handlePointerDown(event, item, "resize")
                }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
