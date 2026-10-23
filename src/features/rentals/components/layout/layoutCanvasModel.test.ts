import { describe, expect, it } from "vitest"

import {
  arrangeEvenly,
  autoPlaceItems,
  compareResourceNames,
  DEFAULT_ASPECT_RATIO,
  orderByResourceName,
  orderCanvasItemsForReading,
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
