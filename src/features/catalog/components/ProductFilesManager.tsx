import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { CatalogProductImageGallery } from "@/features/catalog/components/CatalogProductImageGallery"
import { catalogFileRejection } from "@/features/catalog/lib/catalogFileRules"
import { selectCatalogProductImages } from "@/features/catalog/lib/selectCatalogProductImages"
import type { CatalogFileVisibility, CatalogProductFile } from "@/features/catalog/schemas/catalogSchemas"
import {
  deleteCatalogProductFile,
  getCatalogProductFileUrl,
  uploadCatalogProductFile,
} from "@/features/catalog/services/catalogService"

const MAX_PREVIEW_REFRESH_ATTEMPTS = 2
const CUSTOMER_VISIBLE_FILE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
const INTERNAL_FILE_ACCEPT = ".pdf,.stl,.step,.stp,.dxf,application/pdf"

export type ProductFilesReload = (options?: { filesOnly?: boolean }) => void | Promise<unknown>

/**
 * Photos and files of a product: upload with a visibility choice, list, open (signed URL) and delete with confirm.
 * Every action saves immediately; the parent only supplies the current files and a reload.
 */
export function ProductFilesManager({ productId, productName, files, canManage, onReload, onBusyChange }: {
  productId: string
  productName: string
  files: readonly CatalogProductFile[]
  canManage: boolean
  onReload: ProductFilesReload
  /** True while an upload or delete is in flight, so the host can hold navigation and saving. */
  onBusyChange?: (busy: boolean) => void
}) {
  const { t } = useTranslation()
  const [uploadVisibility, setUploadVisibility] = useState<CatalogFileVisibility>("CustomerVisible")
  const [fileBusy, setFileBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileName, setSelectedFileName] = useState("")
  const [fileError, setFileError] = useState<string | null>(null)
  useEffect(() => { onBusyChange?.(fileBusy) }, [fileBusy, onBusyChange])
  useEffect(() => () => onBusyChange?.(false), [onBusyChange])
  const [pendingDelete, setPendingDelete] = useState<CatalogProductFile | null>(null)
  const [signedImageUrls, setSignedImageUrls] = useState<Record<string, string>>({})
  const [previewFailures, setPreviewFailures] = useState<Record<string, boolean>>({})
  const [previewRevision, setPreviewRevision] = useState(0)
  // Bounded signed-preview refresh keyed by URL (not by file): a freshly signed
  // URL that later expires can be refreshed again, and a failed refresh may be
  // retried until MAX_PREVIEW_REFRESH_ATTEMPTS is reached for that URL.
  const previewRefreshAttempts = useRef(new Map<string, { attempts: number; pending: boolean }>())
  // Pending backoff timers for failed refreshes, cleared on unmount/file change.
  const previewRefreshTimers = useRef(new Set<ReturnType<typeof setTimeout>>())

  // Re-sign an expired preview URL for a file, counting each try against the per-URL budget.
  // A broken gallery emits no second error event, so a failed signing request reschedules
  // itself with a small linear backoff until the budget is exhausted.
  const refreshSignedPreview = useCallback(
    function retryPreview(source: string, fileId: string, maxAttempts = MAX_PREVIEW_REFRESH_ATTEMPTS) {
      const refresh = previewRefreshAttempts.current.get(source) ?? { attempts: 0, pending: false }
      if (refresh.pending || refresh.attempts >= maxAttempts) return
      refresh.attempts += 1
      refresh.pending = true
      previewRefreshAttempts.current.set(source, refresh)
      void getCatalogProductFileUrl(productId, fileId)
        .then(({ url }) => {
          if (previewRefreshAttempts.current.get(source) !== refresh) return
          if (!url.trim()) throw new Error("Empty preview URL")
          refresh.pending = false
          setSignedImageUrls((current) => ({ ...current, [`${productId}:${fileId}`]: url }))
          // Re-signing may return the same URL; still reset the gallery's failed image.
          setPreviewRevision((current) => current + 1)
        })
        .catch(() => {
          if (previewRefreshAttempts.current.get(source) !== refresh) return
          if (refresh.attempts >= maxAttempts) {
            refresh.pending = false
            setPreviewFailures((current) => ({ ...current, [`${productId}:${fileId}`]: true }))
            return
          }
          const timer = setTimeout(() => {
            previewRefreshTimers.current.delete(timer)
            refresh.pending = false
            retryPreview(source, fileId, maxAttempts)
          }, 500 * refresh.attempts)
          previewRefreshTimers.current.add(timer)
        })
    },
    [productId],
  )

  useEffect(() => {
    const timers = previewRefreshTimers.current
    const attempts = previewRefreshAttempts.current
    return () => {
      attempts.clear()
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [productId])

  // The file set changed (upload/delete): forget signed URLs of removed files and reset the refresh budget.
  const fileKey = files.map((file) => file.id).join("|")
  const previousFileKey = useRef(fileKey)
  useEffect(() => {
    if (previousFileKey.current === fileKey) return
    previousFileKey.current = fileKey
    const keys = new Set(fileKey.split("|").filter(Boolean).map((id) => `${productId}:${id}`))
    setSignedImageUrls((current) => Object.fromEntries(Object.entries(current).filter(([key]) => keys.has(key))))
    previewRefreshAttempts.current.clear()
    previewRefreshTimers.current.forEach(clearTimeout)
    previewRefreshTimers.current.clear()
  }, [fileKey, productId])

  // Files without a usable URL get one signed on mount.
  useEffect(() => {
    const candidates = selectCatalogProductImages(
      files
        .filter((file) => file.status !== "Pending" && file.status !== "Failed" && !file.url?.trim() && !signedImageUrls[`${productId}:${file.id}`])
        .map((file) => ({ ...file, url: "pending" })),
    )
    for (const file of candidates) refreshSignedPreview(`initial:${productId}:${file.id}`, file.id, 3)
  }, [files, productId, signedImageUrls, refreshSignedPreview])

  const previewImages = selectCatalogProductImages(
    files.filter((file) => file.status !== "Pending" && file.status !== "Failed").map((file) => ({
      ...file,
      url: signedImageUrls[`${productId}:${file.id}`] || file.url?.trim(),
    })),
  )

  async function onUploadFile(file: File | undefined) {
    if (!file) return
    const rejection = catalogFileRejection(file, uploadVisibility)
    if (rejection != null) {
      setFileError(t(`catalog.products.files.${rejection}`, { name: file.name }))
      return
    }
    setFileBusy(true)
    setFileError(null)
    try {
      await uploadCatalogProductFile(productId, file, uploadVisibility)
      await onReload()
      toast.success(t("catalog.products.toastFileUploaded"))
    } catch (error) {
      const message = error instanceof Error ? error.message : t("apiErrors.uploadCatalogFile")
      setFileError(message)
      toast.error(message)
      await onReload({ filesOnly: true })
    } finally {
      setFileBusy(false)
    }
  }

  async function onDeleteFile(fileId: string) {
    setFileBusy(true)
    try {
      await deleteCatalogProductFile(productId, fileId)
      await onReload()
      toast.success(t("catalog.products.toastFileDeleted"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("apiErrors.deleteCatalogFile"))
    } finally {
      setFileBusy(false)
    }
  }

  async function onOpenFile(fileId: string) {
    try {
      const result = await getCatalogProductFileUrl(productId, fileId)
      window.open(result.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("apiErrors.loadCatalogFileUrl"))
    }
  }

  return (
    <div className="min-w-0 w-full max-w-xl space-y-3" data-testid="product-files-manager" onErrorCapture={(event) => {
      if (!(event.target instanceof HTMLImageElement)) return
      const source = event.target.getAttribute("src")
      if (!source) return
      const image = previewImages.find((item) => item.url === source)
      if (!image) return
      refreshSignedPreview(source, image.id)
      setPreviewFailures((current) => ({ ...current, [`${productId}:${image.id}`]: true }))
    }} onLoadCapture={(event) => {
      if (!(event.target instanceof HTMLImageElement)) return
      const source = event.target.getAttribute("src")
      const image = previewImages.find((item) => item.url === source)
      if (!image) return
      setPreviewFailures((current) => ({ ...current, [`${productId}:${image.id}`]: false }))
    }}>
      {previewImages.length > 0 ? (
        <CatalogProductImageGallery
          key={`${previewRevision}:${previewImages.map((image) => image.url).join("|")}`}
          images={previewImages}
          alt={productName}
          frameClassName="h-40 w-full rounded-lg"
        />
      ) : null}
      {files.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {files.map((file) => (
            <li key={file.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 max-w-full">
                <span className="block truncate">
                  {file.fileName}{" "}
                  <Badge variant="outline">
                    {file.visibility === "CustomerVisible"
                      ? t("catalog.products.files.customerVisible")
                      : t("catalog.products.files.internal")}
                  </Badge>
                </span>
                {file.status === "Pending" || file.status === "Failed" ? (
                  <p className="text-sm text-destructive">
                    {t(file.status === "Pending" ? "catalog.products.files.pendingRecord" : "catalog.products.files.failedRecord")}
                  </p>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {file.status !== "Pending" && file.status !== "Failed" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void onOpenFile(file.id)}>
                    {t("catalog.products.files.open")}
                  </Button>
                ) : null}
                {file.status !== "Pending" && file.status !== "Failed" && previewFailures[`${productId}:${file.id}`] ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => {
                    const source = `manual:${productId}:${file.id}`
                    previewRefreshAttempts.current.delete(source)
                    refreshSignedPreview(source, file.id, 3)
                  }}>
                    {t("catalog.products.files.retry")}
                  </Button>
                ) : null}
                {canManage ? (
                  <Button type="button" size="sm" variant="ghost" disabled={fileBusy} onClick={() => setPendingDelete(file)}>
                    {t("common.delete")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("catalog.products.files.empty")}</p>
      )}
      {canManage ? (
        <div className="flex min-w-0 w-full flex-wrap gap-2">
          <div className="min-w-0 max-w-full space-y-1">
            <span className="block text-sm font-medium">{t("catalog.products.files.whoSees")}</span>
            <SegmentedControl
              className="min-w-0 max-w-full flex-wrap"
              label={t("catalog.products.files.whoSees")}
              value={uploadVisibility}
              disabled={fileBusy}
              onChange={setUploadVisibility}
              options={[
                { value: "CustomerVisible", label: t("catalog.products.files.customerShort") },
                { value: "InternalB2B", label: t("catalog.products.files.internalShort") },
              ]}
            />
          </div>
          <div className="relative min-w-0 basis-64 flex-1 space-y-1">
            <input
              ref={fileInputRef}
              className="sr-only"
              tabIndex={-1}
              aria-describedby="catalog-product-file-name"
              id="catalog-product-file-input"
              aria-label={t("catalog.products.files.select")}
              type="file"
              disabled={fileBusy}
              accept={uploadVisibility === "CustomerVisible" ? CUSTOMER_VISIBLE_FILE_ACCEPT : INTERNAL_FILE_ACCEPT}
              onChange={(event) => {
                setSelectedFileName(event.target.files?.[0]?.name ?? "")
                void onUploadFile(event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <Button type="button" variant="outline" className="min-h-11" disabled={fileBusy} onClick={() => fileInputRef.current?.click()}>
              {t("catalog.products.files.select")}
            </Button>
            <p id="catalog-product-file-name" role="status" className="break-all text-sm text-muted-foreground">
              {selectedFileName ? t("catalog.products.files.selectedFile", { name: selectedFileName }) : t("catalog.products.files.noFile")}
            </p>
          </div>
        </div>
      ) : null}
      {fileError !== null ? (
        <p role="alert" className="text-sm text-destructive">{fileError}</p>
      ) : null}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open && !fileBusy) setPendingDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("catalog.products.files.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("catalog.products.files.deleteConfirmBody", { name: pendingDelete?.fileName ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>{t("common.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={fileBusy} onClick={() => {
              const target = pendingDelete
              setPendingDelete(null)
              if (target) void onDeleteFile(target.id)
            }}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
