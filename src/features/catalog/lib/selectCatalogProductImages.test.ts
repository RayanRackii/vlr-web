import { describe, expect, it } from "vitest"

import { selectCatalogProductImages } from "@/features/catalog/lib/selectCatalogProductImages"

function file(overrides: {
  id: string
  mimeType: string
  url?: string | null
  fileName?: string
}) {
  return {
    id: overrides.id,
    mimeType: overrides.mimeType,
    url: overrides.url,
    fileName: overrides.fileName ?? `${overrides.id}.bin`,
  }
}

describe("selectCatalogProductImages", () => {
  it("excludes pdf and other non-image files", () => {
    const result = selectCatalogProductImages([
      file({
        id: "pdf",
        mimeType: "application/pdf",
        url: "https://cdn.example/spec.pdf",
        fileName: "spec.pdf",
      }),
      file({
        id: "stl",
        mimeType: "model/stl",
        url: "https://cdn.example/part.stl",
        fileName: "part.stl",
      }),
      file({
        id: "png",
        mimeType: "image/png",
        url: "https://cdn.example/photo.png",
        fileName: "photo.png",
      }),
    ])

    expect(result).toEqual([
      {
        id: "png",
        url: "https://cdn.example/photo.png",
        fileName: "photo.png",
      },
    ])
  })

  it("excludes files with missing or empty urls", () => {
    const result = selectCatalogProductImages([
      file({ id: "null-url", mimeType: "image/jpeg", url: null }),
      file({ id: "undefined-url", mimeType: "image/png" }),
      file({ id: "blank-url", mimeType: "image/webp", url: "   " }),
      file({
        id: "ok",
        mimeType: "image/webp",
        url: "https://cdn.example/ok.webp",
        fileName: "ok.webp",
      }),
    ])

    expect(result.map((image) => image.id)).toEqual(["ok"])
  })

  it("keeps API order among renderable images", () => {
    const result = selectCatalogProductImages([
      file({
        id: "first",
        mimeType: "image/jpeg",
        url: "https://cdn.example/first.jpg",
        fileName: "first.jpg",
      }),
      file({
        id: "pdf",
        mimeType: "application/pdf",
        url: "https://cdn.example/skip.pdf",
      }),
      file({
        id: "second",
        mimeType: "image/png",
        url: "https://cdn.example/second.png",
        fileName: "second.png",
      }),
      file({
        id: "third",
        mimeType: "image/webp",
        url: "https://cdn.example/third.webp",
        fileName: "third.webp",
      }),
    ])

    expect(result.map((image) => image.id)).toEqual(["first", "second", "third"])
  })
})
