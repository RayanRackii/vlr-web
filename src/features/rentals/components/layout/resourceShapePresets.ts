/**
 * Starting points for a visual template revision's raw SVG fields. Each preset is a
 * generic resource shape (not court/room/table-specific wording in code) that an admin
 * can pick to pre-fill the editor instead of hand-writing markup; the result stays a
 * plain revision draft, freely editable afterward. Flat fills, no stroke-width
 * inconsistency, `currentColor`-free (color comes from `defaultColor`) so the same
 * preset reads correctly composited at any admin-chosen color, in light or dark mode.
 */
export type ResourceShapePreset = {
  key: string
  labelKey: string
  floorSvg: string
  linesSvg: string
  netSvg: string
  viewBox: string
  aspectRatio: string
  defaultColor: string
  defaultIcon: string
}

export const RESOURCE_SHAPE_PRESETS: readonly ResourceShapePreset[] = [
  {
    key: "rectangle-area",
    labelKey: "resourceVisual.shapePresets.rectangleArea",
    floorSvg: '<rect x="2" y="2" width="156" height="96" rx="6" fill="#D1D5DB"/>',
    linesSvg: "",
    netSvg: "",
    viewBox: "0 0 160 100",
    aspectRatio: "1.6",
    defaultColor: "#4D6A92",
    defaultIcon: "layout-template",
  },
  {
    key: "court-with-lines",
    labelKey: "resourceVisual.shapePresets.courtWithLines",
    floorSvg: '<rect x="2" y="2" width="156" height="96" rx="4" fill="#D1D5DB"/>',
    linesSvg:
      '<rect x="10" y="10" width="140" height="80" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
      '<line x1="80" y1="10" x2="80" y2="90" stroke="#FFFFFF" stroke-width="2"/>',
    netSvg: '<line x1="80" y1="6" x2="80" y2="94" stroke="#1F2937" stroke-width="3"/>',
    viewBox: "0 0 160 100",
    aspectRatio: "1.6",
    defaultColor: "#2F6D4F",
    defaultIcon: "layout-template",
  },
  {
    key: "round-table",
    labelKey: "resourceVisual.shapePresets.roundTable",
    floorSvg: '<circle cx="50" cy="50" r="46" fill="#D1D5DB"/>',
    linesSvg: '<circle cx="50" cy="50" r="46" fill="none" stroke="#9CA3AF" stroke-width="2"/>',
    netSvg: "",
    viewBox: "0 0 100 100",
    aspectRatio: "1",
    defaultColor: "#8A5A3B",
    defaultIcon: "table",
  },
  {
    key: "square-table",
    labelKey: "resourceVisual.shapePresets.squareTable",
    floorSvg: '<rect x="4" y="4" width="92" height="92" rx="8" fill="#D1D5DB"/>',
    linesSvg: "",
    netSvg: "",
    viewBox: "0 0 100 100",
    aspectRatio: "1",
    defaultColor: "#8A5A3B",
    defaultIcon: "table-2",
  },
  {
    key: "chair",
    labelKey: "resourceVisual.shapePresets.chair",
    floorSvg:
      '<rect x="22" y="40" width="56" height="48" rx="8" fill="#D1D5DB"/>' +
      '<rect x="22" y="8" width="56" height="34" rx="8" fill="#D1D5DB"/>',
    linesSvg: "",
    netSvg: "",
    viewBox: "0 0 100 100",
    aspectRatio: "1",
    defaultColor: "#6B7280",
    defaultIcon: "armchair",
  },
  {
    key: "seat",
    labelKey: "resourceVisual.shapePresets.seat",
    floorSvg: '<rect x="2" y="16" width="156" height="28" rx="10" fill="#D1D5DB"/>',
    linesSvg: "",
    netSvg: "",
    viewBox: "0 0 160 60",
    aspectRatio: "2.67",
    defaultColor: "#6B7280",
    defaultIcon: "sofa",
  },
  {
    key: "equipment-box",
    labelKey: "resourceVisual.shapePresets.equipmentBox",
    floorSvg: '<rect x="6" y="6" width="88" height="88" rx="4" fill="#D1D5DB"/>',
    linesSvg:
      '<line x1="6" y1="6" x2="94" y2="94" stroke="#9CA3AF" stroke-width="2"/>' +
      '<line x1="94" y1="6" x2="6" y2="94" stroke="#9CA3AF" stroke-width="2"/>',
    netSvg: "",
    viewBox: "0 0 100 100",
    aspectRatio: "1",
    defaultColor: "#B45309",
    defaultIcon: "package",
  },
] as const
