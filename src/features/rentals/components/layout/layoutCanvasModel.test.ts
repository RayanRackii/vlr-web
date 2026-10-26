import { describe, expect, it } from "vitest"

import {
  arrangeEvenly,
  autoPlaceItems,
  compareResourceNames,
  DEFAULT_ASPECT_RATIO,
  orderByResourceName,
  orderCanvasItemsForReading,
  snapMovePosition,
  snapResizeSize,
} from "@/features/rentals/components/layout/layoutCanvasModel"

describe("resource name order", () => {
  it("defaults new blocks and the canvas to a court-friendly 2:1 shape", () => {
    expect(DEFAULT_ASPECT_RATIO).toBe(2)
    expect(autoPlaceItems(["one", "two"])).toMatchObject([
      { rentalAssetId: "one", widthPercent: 20, heightPercent: 10 },
      { rentalAssetId: "two", widthPercent: 20, heightPercent: 10 },
    ])
  })

  it("sorts resource names with numeric segments", () => {
    const names = ["Q-1", "Q-10", "Q-2", "Q-4", "Q-6", "Q-5"]
    expect([...names].sort(compareResourceNames)).toEqual([
      "Q-1",
      "Q-2",
      "Q-4",
      "Q-5",
      "Q-6",
      "Q-10",
    ])
  })

  it("places an auto grid in natural name order", () => {
    const assets = orderByResourceName(
      [
        { id: "6", name: "Q-6" },
        { id: "5", name: "Q-5" },
        { id: "1", name: "Q-1" },
        { id: "4", name: "Q-4" },
        { id: "2", name: "Q-2" },
        { id: "3", name: "Q-3" },
      ],
      (asset) => asset.name,
    )
    const placed = arrangeEvenly(assets.map((asset) => asset.id))
    const names = placed.map(
      (item) => assets.find((asset) => asset.id === item.rentalAssetId)?.name,
    )

    expect(names).toEqual(["Q-1", "Q-2", "Q-3", "Q-4", "Q-5", "Q-6"])
    expect(orderCanvasItemsForReading(
      placed.map((item, index) => ({
        ...item,
        label: names[index] ?? "",
      })),
    ).map((item) => item.label)).toEqual(names)
  })
})

describe("snapMovePosition", () => {
  it("pulls a near-grid position onto the nearest grid line", () => {
    expect(snapMovePosition(21.3, 39.6, 20, 10, [])).toEqual({
      xPercent: 20,
      yPercent: 40,
    })
  })

  it("leaves a position untouched when it falls in the dead zone between grid lines", () => {
    expect(snapMovePosition(22, 2, 20, 10, [])).toEqual({
      xPercent: 22,
      yPercent: 2,
    })
  })

  it("snaps onto a sibling's right edge before falling back to the grid", () => {
    const siblings = [{ xPercent: 10, yPercent: 10, widthPercent: 20, heightPercent: 10 }]
    // Sibling's right edge is at 30; dragging to 30.4 should snap flush against it.
    expect(snapMovePosition(30.4, 10.2, 15, 10, siblings)).toEqual({
      xPercent: 30,
      yPercent: 10,
    })
  })

  it("snaps a tile's right edge flush against a sibling's left edge", () => {
    const siblings = [{ xPercent: 50, yPercent: 0, widthPercent: 20, heightPercent: 10 }]
    // Tile is 15 wide; placing its right edge (x + 15) at the sibling's left edge (50)
    // means x should land on 35.
    expect(snapMovePosition(34.6, 0, 15, 10, siblings)).toEqual({
      xPercent: 35,
      yPercent: 0,
    })
  })
})

describe("snapResizeSize", () => {
  it("pulls the right/bottom edge onto the nearest grid line", () => {
    expect(snapResizeSize(10, 10, 21.3, 18.3, [])).toEqual({
      widthPercent: 22,
      heightPercent: 18,
    })
  })

  it("snaps the resized edge flush against a sibling's edge", () => {
    const siblings = [{ xPercent: 40, yPercent: 0, widthPercent: 20, heightPercent: 30 }]
    // Resizing from x=10 so the right edge (10 + width) lands on the sibling's left edge (40).
    expect(snapResizeSize(10, 0, 29.6, 10, siblings)).toEqual({
      widthPercent: 30,
      heightPercent: 10,
    })
  })

  it("never collapses below the minimum tile size", () => {
    expect(snapResizeSize(10, 10, 1, 1, [])).toEqual({
      widthPercent: 8,
      heightPercent: 8,
    })
  })
})
