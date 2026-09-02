import type {
  CatalogFileVisibility,
  CatalogProductFormValues,
} from "@/features/catalog/schemas/catalogSchemas"

export type PendingFileStatus = "waiting" | "sending" | "sent" | "error"

export type PendingFile = {
  clientId: string
  file: File
  visibility: CatalogFileVisibility
  status: PendingFileStatus
  error?: string
}

export type CatalogProductWriteBody = {
  name: string
  code: string | null
  description: string | null
  price: number | null
  currency: string
}

export type SaveCatalogProductCreateLock = {
  inFlight: boolean
}

export type SaveCatalogProductCreateResult = {
  productId: string | null
  files: PendingFile[]
  createdNow: boolean
  allUploaded: boolean
  skipped: boolean
}

type CreateProduct = (body: CatalogProductWriteBody) => Promise<{ id: string }>

type UploadFile = (
  productId: string,
  file: File,
  visibility: CatalogFileVisibility,
) => Promise<unknown>

function clonePendingFiles(files: PendingFile[]): PendingFile[] {
  return files.map((item) => ({ ...item }))
}

function uploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Upload failed"
}

export function toCatalogProductWriteBody(
  values: CatalogProductFormValues,
  price: number | null,
): CatalogProductWriteBody {
  return {
    name: values.name,
    code: values.code.trim().length > 0 ? values.code.trim() : null,
    description:
      values.description.trim().length > 0 ? values.description.trim() : null,
    price,
    currency: values.currency,
  }
}

export function newPendingCatalogFile(
  file: File,
  visibility: CatalogFileVisibility,
  clientId: string = crypto.randomUUID(),
): PendingFile {
  return {
    clientId,
    file,
    visibility,
    status: "waiting",
  }
}

async function uploadPendingFiles(options: {
  productId: string
  files: PendingFile[]
  uploadFile: UploadFile
  onlyClientId?: string
  onFilesChange?: (files: PendingFile[]) => void
}): Promise<PendingFile[]> {
  const emit = () => options.onFilesChange?.(clonePendingFiles(options.files))

  for (const pending of options.files) {
    if (options.onlyClientId && pending.clientId !== options.onlyClientId) {
      continue
    }

    if (pending.status === "sent") {
      continue
    }

    if (pending.status !== "waiting" && pending.status !== "error") {
      continue
    }

    pending.status = "sending"
    delete pending.error
    emit()

    try {
      await options.uploadFile(
        options.productId,
        pending.file,
        pending.visibility,
      )
      pending.status = "sent"
      delete pending.error
    } catch (error) {
      pending.status = "error"
      pending.error = uploadErrorMessage(error)
    }

    emit()
  }

  return clonePendingFiles(options.files)
}

export async function saveCatalogProductCreate(options: {
  createdProductId: string | null
  values: CatalogProductWriteBody
  pendingFiles: PendingFile[]
  createProduct: CreateProduct
  uploadFile: UploadFile
  lock: SaveCatalogProductCreateLock
  onFilesChange?: (files: PendingFile[]) => void
}): Promise<SaveCatalogProductCreateResult> {
  if (options.lock.inFlight) {
    return {
      productId: options.createdProductId,
      files: clonePendingFiles(options.pendingFiles),
      createdNow: false,
      allUploaded: options.pendingFiles.every((file) => file.status === "sent"),
      skipped: true,
    }
  }

  options.lock.inFlight = true
  const files = clonePendingFiles(options.pendingFiles)

  try {
    let productId = options.createdProductId
    let createdNow = false

    if (productId == null) {
      const created = await options.createProduct(options.values)
      productId = created.id
      createdNow = true
    }

    const nextFiles = await uploadPendingFiles({
      productId,
      files,
      uploadFile: options.uploadFile,
      onFilesChange: options.onFilesChange,
    })

    return {
      productId,
      files: nextFiles,
      createdNow,
      allUploaded: nextFiles.every((file) => file.status === "sent"),
      skipped: false,
    }
  } finally {
    options.lock.inFlight = false
  }
}

export async function retryPendingCatalogFile(options: {
  productId: string
  pendingFiles: PendingFile[]
  clientId: string
  uploadFile: UploadFile
  lock: SaveCatalogProductCreateLock
  onFilesChange?: (files: PendingFile[]) => void
}): Promise<SaveCatalogProductCreateResult> {
  if (options.lock.inFlight) {
    return {
      productId: options.productId,
      files: clonePendingFiles(options.pendingFiles),
      createdNow: false,
      allUploaded: options.pendingFiles.every((file) => file.status === "sent"),
      skipped: true,
    }
  }

  options.lock.inFlight = true
  const files = clonePendingFiles(options.pendingFiles)

  try {
    const nextFiles = await uploadPendingFiles({
      productId: options.productId,
      files,
      uploadFile: options.uploadFile,
      onlyClientId: options.clientId,
      onFilesChange: options.onFilesChange,
    })

    return {
      productId: options.productId,
      files: nextFiles,
      createdNow: false,
      allUploaded: nextFiles.every((file) => file.status === "sent"),
      skipped: false,
    }
  } finally {
    options.lock.inFlight = false
  }
}
