import { describe, expect, it } from "vitest"
import adminTemplates from "@/features/rentals/schemas/__fixtures__/admin-visual-templates.json"
import dailyAvailability from "@/features/rentals/schemas/__fixtures__/daily-availability.json"
import publicMap from "@/features/rentals/schemas/__fixtures__/public-booking-map.json"
import publicMaps from "@/features/rentals/schemas/__fixtures__/public-booking-maps.json"
import tags from "@/features/rentals/schemas/__fixtures__/visual-tags.json"
import {
  bookingMapSettingsSchema,
  dailyAvailabilitySchema,
  mapCompositionSchema,
  mapDecorationSchema,
  mapItemSchema,
  publicMapListSchema,
  publicMapSchema,
  publicVisualRevisionSchema,
  visualPageSchema,
  visualRevisionSchema,
  visualTagSchema,
  visualTemplateSchema,
} from "@/features/rentals/schemas/resourceVisualSchemas"

describe("resource visual API schemas", () => {
  it("parses admin templates and non-RFC catalog GUIDs", () => {
    expect(visualPageSchema.parse(adminTemplates).items[0]?.publishedRevision?.status).toBe("Published")
    expect(visualTemplateSchema.parse(adminTemplates.items[0]).tags).toHaveLength(3)
    expect(visualRevisionSchema.parse(adminTemplates.items[0]?.publishedRevision).defaultColor).toBe("#DCC08B")
    expect(visualTagSchema.parse(tags[0]).kind).toBe("Segment")
    expect(tags.map((tag) => visualTagSchema.parse(tag).facet)).toEqual(["segment", "floor", "sport"])
  })

  it("parses public map list and map payloads including visual revisions", () => {
    expect(publicMapListSchema.parse(publicMaps).maps[0]?.id).toBe("3f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b")
    const parsed = publicMapSchema.parse(publicMap)
    expect(parsed.visualRevisions).toHaveLength(1)
    expect(publicVisualRevisionSchema.parse(parsed.visualRevisions[0]).defaultColor).toBe("#DCC08B")
  })

  it("parses daily availability, map item, decoration, composition, and settings", () => {
    expect(dailyAvailabilitySchema.parse(dailyAvailability).resources[0]?.windows[0]?.state).toBe("Available")
    const item = publicMap.items[0]
    expect(mapItemSchema.parse(item).rentalAssetId).toBe(item.rentalAssetId)
    expect(mapDecorationSchema.parse({ id: item.id, kind: "Label", label: "Entrada", iconKey: null, xPercent: 0, yPercent: 0, widthPercent: 10, heightPercent: 10, rotation: 0, zIndex: 0, style: {}, geometry: null }).kind).toBe("Label")
    expect(mapCompositionSchema.parse({ id: publicMap.id, unitId: publicMap.unitId, name: publicMap.name, isActive: true, sortOrder: 0, aspectRatio: publicMap.aspectRatio, widthPercent: publicMap.widthPercent, version: publicMap.version, items: publicMap.items, decorations: [] }).items).toHaveLength(1)
    expect(bookingMapSettingsSchema.parse(publicMaps.settings).defaultView).toBe("Map")
  })
})
