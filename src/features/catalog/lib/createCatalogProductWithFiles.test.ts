import { describe, expect, it, vi } from "vitest"

import {
  newPendingCatalogFile,
  retryPendingCatalogFile,
  saveCatalogProductCreate,
  toCatalogProductWriteBody,
  type PendingFile,
  type SaveCatalogProductCreateLock,
} from "@/features/catalog/lib/createCatalogProductWithFiles"

function fileNamed(name: string): File {
  return new File(["content"], name, { type: "application/pdf" })
}

function waitingFile(name: string, clientId: string): PendingFile {
  return newPendingCatalogFile(fileNamed(name), "InternalB2B", clientId)
}

const values = {
  name: "Monitor Dell 24",
  code: "MD-24",
  description: null,
  price: 10,
  currency: "BRL",
}

describe("toCatalogProductWriteBody", () => {
  it("maps empty code to null", () => {
    expect(
      toCatalogProductWriteBody(
        {
          name: "Cabide",
          code: "   ",
          description: "",
          price: "",
          currency: "BRL",
        },
        null,
      ),
    ).toEqual({
      name: "Cabide",
      code: null,
      description: null,
      price: null,
      currency: "BRL",
    })
  })
})

describe("saveCatalogProductCreate", () => {
  it("creates once then uploads queued files after the product id exists", async () => {
    const order: string[] = []
    const pendingFiles = [
      waitingFile("photo.webp", "f1"),
      waitingFile("manual.pdf", "f2"),
    ]
    const createProduct = vi.fn(async () => {
      order.push("create")
      expect(pendingFiles).toHaveLength(2)
      return { id: "product-1" }
    })
    const uploadFile = vi.fn(async (productId: string, file: File) => {
      order.push(`upload:${file.name}`)
      expect(productId).toBe("product-1")
    })

    const result = await saveCatalogProductCreate({
      createdProductId: null,
      values,
      pendingFiles,
      createProduct,
      uploadFile,
      lock: { inFlight: false },
    })

    expect(createProduct).toHaveBeenCalledTimes(1)
    expect(createProduct).toHaveBeenCalledWith(values)
    expect(uploadFile).toHaveBeenCalledTimes(2)
    expect(order).toEqual(["create", "upload:photo.webp", "upload:manual.pdf"])
    expect(result).toMatchObject({
      productId: "product-1",
      createdNow: true,
      allUploaded: true,
      skipped: false,
    })
    expect(result.files.every((file) => file.status === "sent")).toBe(true)
  })

  it("keeps the same product id when one upload fails and retry does not create again", async () => {
    const createProduct = vi.fn(async () => ({ id: "product-1" }))
    let failBroken = true
    const uploadFile = vi.fn(async (_productId: string, file: File) => {
      if (file.name === "broken.pdf" && failBroken) {
        throw new Error("storage unavailable")
      }
    })
    const lock: SaveCatalogProductCreateLock = { inFlight: false }
    const pendingFiles = [
      waitingFile("ok.pdf", "ok"),
      waitingFile("broken.pdf", "bad"),
    ]

    const first = await saveCatalogProductCreate({
      createdProductId: null,
      values,
      pendingFiles,
      createProduct,
      uploadFile,
      lock,
    })

    expect(first.productId).toBe("product-1")
    expect(first.allUploaded).toBe(false)
    expect(first.files.map((file) => file.status)).toEqual(["sent", "error"])
    expect(first.files[1]?.error).toBe("storage unavailable")

    failBroken = false
    const retried = await retryPendingCatalogFile({
      productId: first.productId ?? "product-1",
      pendingFiles: first.files,
      clientId: "bad",
      uploadFile,
      lock,
    })

    expect(createProduct).toHaveBeenCalledTimes(1)
    expect(uploadFile.mock.calls.map((call) => call[1].name)).toEqual([
      "ok.pdf",
      "broken.pdf",
      "broken.pdf",
    ])
    expect(retried.createdNow).toBe(false)
    expect(retried.allUploaded).toBe(true)
    expect(retried.files.map((file) => file.status)).toEqual(["sent", "sent"])
  })

  it("leaves file.error unset when upload throws a non-Error", async () => {
    const result = await saveCatalogProductCreate({
      createdProductId: null,
      values,
      pendingFiles: [waitingFile("a.pdf", "a")],
      createProduct: vi.fn(async () => ({ id: "product-1" })),
      uploadFile: vi.fn(async () => {
        throw "boom"
      }),
      lock: { inFlight: false },
    })

    expect(result.files[0]?.status).toBe("error")
    expect(result.files[0]?.error).toBeUndefined()
  })

  it("does not repeat uploads for files already marked sent", async () => {
    const createProduct = vi.fn(async () => ({ id: "product-1" }))
    const uploadFile = vi.fn(async () => undefined)
    const lock: SaveCatalogProductCreateLock = { inFlight: false }

    const first = await saveCatalogProductCreate({
      createdProductId: null,
      values,
      pendingFiles: [waitingFile("a.pdf", "a"), waitingFile("b.pdf", "b")],
      createProduct,
      uploadFile,
      lock,
    })

    const second = await saveCatalogProductCreate({
      createdProductId: first.productId,
      values,
      pendingFiles: first.files,
      createProduct,
      uploadFile,
      lock,
    })

    expect(createProduct).toHaveBeenCalledTimes(1)
    expect(uploadFile).toHaveBeenCalledTimes(2)
    expect(second.createdNow).toBe(false)
    expect(second.allUploaded).toBe(true)
  })

  it("guards a second submit while create/upload is in flight", async () => {
    let resolveCreate: ((value: { id: string }) => void) | undefined
    const createProduct = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveCreate = resolve
        }),
    )
    const uploadFile = vi.fn(async () => undefined)
    const lock: SaveCatalogProductCreateLock = { inFlight: false }

    const firstPromise = saveCatalogProductCreate({
      createdProductId: null,
      values,
      pendingFiles: [],
      createProduct,
      uploadFile,
      lock,
    })

    await vi.waitFor(() => {
      expect(lock.inFlight).toBe(true)
    })

    const skipped = await saveCatalogProductCreate({
      createdProductId: null,
      values,
      pendingFiles: [],
      createProduct,
      uploadFile,
      lock,
    })

    expect(skipped.skipped).toBe(true)
    expect(createProduct).toHaveBeenCalledTimes(1)

    resolveCreate?.({ id: "product-1" })
    const first = await firstPromise
    expect(first.skipped).toBe(false)
    expect(first.productId).toBe("product-1")
    expect(lock.inFlight).toBe(false)
  })

  it("surfaces duplicate-code errors without uploading or keeping a product id", async () => {
    const createProduct = vi.fn(async () => {
      throw new Error("A product with this code already exists.")
    })
    const uploadFile = vi.fn(async () => undefined)
    const lock: SaveCatalogProductCreateLock = { inFlight: false }

    await expect(
      saveCatalogProductCreate({
        createdProductId: null,
        values,
        pendingFiles: [waitingFile("a.pdf", "a")],
        createProduct,
        uploadFile,
        lock,
      }),
    ).rejects.toThrow("A product with this code already exists.")

    expect(createProduct).toHaveBeenCalledTimes(1)
    expect(uploadFile).not.toHaveBeenCalled()
    expect(lock.inFlight).toBe(false)
  })
})
