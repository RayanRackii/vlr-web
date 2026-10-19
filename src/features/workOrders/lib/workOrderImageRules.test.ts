import { describe, expect, it } from "vitest"

import {
  SIGNED_URL_REFRESH_LEAD_MS,
  WORK_ORDER_IMAGE_MAX_BYTES,
  canonicalWorkOrderImageFileId,
  isWorkOrderImageFileId,
  signedUrlExpiresAtMs,
  signedUrlRefreshDelayMs,
  workOrderImageRejection,
} from "@/features/workOrders/lib/workOrderImageRules"

const FILE_ID = "3f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e"

function photo(name: string, type: string, size = 128): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe("workOrderImageRejection", () => {
  it("accepts jpeg, png, and webp up to 5 MB", () => {
    expect(workOrderImageRejection(photo("court.jpg", "image/jpeg"))).toBeNull()
    expect(
      workOrderImageRejection(photo("court.jpeg", "image/jpeg")),
    ).toBeNull()
    expect(workOrderImageRejection(photo("court.png", "image/png"))).toBeNull()
    expect(
      workOrderImageRejection(photo("court.webp", "image/webp")),
    ).toBeNull()
    expect(
      workOrderImageRejection(
        photo("court.jpg", "image/jpeg; charset=binary", WORK_ORDER_IMAGE_MAX_BYTES),
      ),
    ).toBeNull()
  })

  it("accepts a camera file that only has a type or only has an extension", () => {
    expect(workOrderImageRejection(photo("image", "image/jpeg"))).toBeNull()
    expect(workOrderImageRejection(photo("image.jpg", ""))).toBeNull()
    expect(
      workOrderImageRejection(photo("image.png", "application/octet-stream")),
    ).toBeNull()
    expect(workOrderImageRejection(photo("shot.jpg", "image/jpg"))).toBeNull()
  })

  it("rejects an empty file, a file over 5 MB, and a type that is not a photo", () => {
    expect(workOrderImageRejection(photo("court.jpg", "image/jpeg", 0))).toBe(
      "tooLarge",
    )
    expect(
      workOrderImageRejection(
        photo("court.jpg", "image/jpeg", WORK_ORDER_IMAGE_MAX_BYTES + 1),
      ),
    ).toBe("tooLarge")
    expect(workOrderImageRejection(photo("court.gif", "image/gif"))).toBe(
      "typeNotAllowed",
    )
    expect(workOrderImageRejection(photo("notes.pdf", "application/pdf"))).toBe(
      "typeNotAllowed",
    )
    expect(workOrderImageRejection(photo("court.jpg", "image/gif"))).toBe(
      "typeNotAllowed",
    )
    expect(workOrderImageRejection(photo("court.gif", "image/jpeg"))).toBe(
      "typeNotAllowed",
    )
  })
})

describe("isWorkOrderImageFileId", () => {
  it("accepts a stored file id and rejects bytes, data URLs, and blanks", () => {
    expect(isWorkOrderImageFileId(FILE_ID)).toBe(true)
    expect(canonicalWorkOrderImageFileId(` ${FILE_ID.toUpperCase()} `)).toBe(
      FILE_ID,
    )
    expect(canonicalWorkOrderImageFileId(FILE_ID.replaceAll("-", ""))).toBe(
      FILE_ID,
    )
    expect(isWorkOrderImageFileId(`{${FILE_ID}}`)).toBe(true)
    expect(isWorkOrderImageFileId(`(${FILE_ID})`)).toBe(true)
    expect(isWorkOrderImageFileId(null)).toBe(false)
    expect(isWorkOrderImageFileId("")).toBe(false)
    expect(isWorkOrderImageFileId("   ")).toBe(false)
    expect(isWorkOrderImageFileId("court.jpg")).toBe(false)
    expect(
      isWorkOrderImageFileId("data:image/jpeg;base64,/9j/4AAQSkZJRg=="),
    ).toBe(false)
  })
})

describe("signed URL expiry", () => {
  const now = Date.UTC(2026, 9, 18, 12, 0, 0)

  it("reads exp, an S3 expiry, and a Supabase token", () => {
    const expSeconds = Math.floor(now / 1000) + 900
    expect(
      signedUrlExpiresAtMs(`https://dev-storage.local/bucket/key?sig=dev&exp=${expSeconds}`),
    ).toBe(expSeconds * 1000)

    expect(
      signedUrlExpiresAtMs(
        "https://s3.example/key?X-Amz-Date=20261018T120000Z&X-Amz-Expires=900",
      ),
    ).toBe(now + 900_000)

    const token = jwt({ exp: expSeconds })
    expect(
      signedUrlExpiresAtMs(`https://project.supabase.co/storage/v1/object/sign/bucket/key?token=${token}`),
    ).toBe(expSeconds * 1000)
    expect(signedUrlExpiresAtMs("https://files.example/plain")).toBeNull()
  })

  it("asks for a new URL 15 seconds before expiry", () => {
    const expSeconds = Math.floor(now / 1000) + 900
    const url = `https://dev-storage.local/bucket/key?exp=${expSeconds}`
    expect(signedUrlRefreshDelayMs(url, now)).toBe(
      900_000 - SIGNED_URL_REFRESH_LEAD_MS,
    )
    expect(signedUrlRefreshDelayMs(url, now + 890_000)).toBe(0)
    expect(signedUrlRefreshDelayMs("https://files.example/plain", now)).toBeNull()
  })
})

function jwt(payload: { exp: number }): string {
  const body = btoa(JSON.stringify(payload))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
  return `header.${body}.sig`
}
