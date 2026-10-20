import { useEffect, useRef, useState } from "react"
import { Camera } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  canonicalWorkOrderImageFileId,
  signedUrlRefreshDelayMs,
  workOrderImageRejection,
} from "@/features/workOrders/lib/workOrderImageRules"
import type { WorkOrderTask } from "@/features/workOrders/schemas/workOrderSchemas"
import {
  getWorkOrderTaskFileUrl,
  uploadWorkOrderTaskFile,
} from "@/features/workOrders/services/workOrdersService"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { isEffectivelyOnline } from "@/lib/connectivity"

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"

/** `setTimeout` stores the delay as a 32-bit signed integer. */
const MAX_REFRESH_DELAY_MS = 2_147_483_647

export function WorkOrderTaskImageField({
  workOrderId,
  task,
  disabled,
  onUploaded,
}: {
  workOrderId: string
  task: WorkOrderTask
  disabled: boolean
  onUploaded: (fileId: string) => void
}) {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRetries = useRef(0)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewRevision, setPreviewRevision] = useState(0)

  const fileId = canonicalWorkOrderImageFileId(task.value)
  const blocked = disabled || !online || uploading

  useEffect(() => {
    previewRetries.current = 0
  }, [fileId])

  useEffect(() => {
    if (fileId == null) {
      return
    }

    const requestedId = fileId
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    function clearTimer() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    async function load() {
      clearTimer()
      if (!isEffectivelyOnline()) {
        return
      }

      setPreviewLoading(true)
      try {
        const result = await getWorkOrderTaskFileUrl(
          workOrderId,
          task.id,
          requestedId,
        )
        if (cancelled) {
          return
        }

        setPreviewUrl(result.url)
        setPreviewError(null)
        const delay = signedUrlRefreshDelayMs(result.url)
        if (delay != null && delay > 0) {
          timer = setTimeout(() => {
            void load()
          }, Math.min(delay, MAX_REFRESH_DELAY_MS))
        }
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        setPreviewError(
          error instanceof Error
            ? error.message
            : t("workOrders.execution.imagePreviewFailed"),
        )
      } finally {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      clearTimer()
    }
  }, [fileId, online, previewRevision, t, task.id, workOrderId])

  function requestFreshPreview() {
    if (previewRetries.current >= 1) {
      setPreviewError(t("workOrders.execution.imagePreviewFailed"))
      return
    }

    previewRetries.current += 1
    setPreviewRevision((current) => current + 1)
  }

  async function onFileSelected(file: File | undefined) {
    if (!file) {
      return
    }

    if (!online || !isEffectivelyOnline()) {
      setFieldError(t("workOrders.execution.imageOffline"))
      return
    }

    const rejection = workOrderImageRejection(file)
    if (rejection === "tooLarge") {
      setFieldError(t("workOrders.execution.imageTooLarge"))
      return
    }

    if (rejection != null) {
      setFieldError(t("workOrders.execution.imageTypeRejected"))
      return
    }

    setUploading(true)
    setProgress(0)
    setFieldError(null)

    try {
      const stored = await uploadWorkOrderTaskFile(
        workOrderId,
        task.id,
        file,
        setProgress,
      )
      previewRetries.current = 0
      onUploaded(stored.value)
      const sameFile =
        fileId != null && fileId.toLowerCase() === stored.value.toLowerCase()
      if (sameFile) {
        setPreviewRevision((current) => current + 1)
      }
      toast.success(t("workOrders.execution.imageUploaded"))
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("workOrders.execution.imageUploadFailed")
      setFieldError(message)
      toast.error(message)
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  const pickerLabel = fileId
    ? t("workOrders.execution.imageReplace")
    : t("workOrders.execution.imageChoose")

  return (
    <div className="space-y-3">
      {fileId == null && !uploading ? (
        <p className="text-sm text-muted-foreground">
          {t("workOrders.execution.imageEmpty")}
        </p>
      ) : null}

      {fileId != null && previewLoading && previewUrl == null ? (
        <Skeleton className="h-40 w-full max-w-sm rounded-lg" />
      ) : null}

      {fileId != null && previewUrl != null && previewError == null ? (
        <img
          src={previewUrl}
          alt={t("workOrders.execution.imagePreviewAlt", { title: task.title })}
          className="max-h-64 w-full max-w-sm rounded-lg border border-border object-contain"
          onError={() => {
            requestFreshPreview()
          }}
        />
      ) : null}

      {uploading ? (
        <div className="max-w-sm space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("workOrders.execution.imageUploading")}
          </p>
          <div
            role="progressbar"
            aria-label={t("workOrders.execution.imageProgress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress ?? undefined}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {disabled ? null : (
        <>
          <Button
            type="button"
            variant={fileId ? "outline" : "default"}
            disabled={blocked}
            onClick={() => {
              inputRef.current?.click()
            }}
          >
            <Camera data-icon="inline-start" />
            {pickerLabel}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            disabled={blocked}
            onChange={(event) => {
              const selected = event.target.files?.[0]
              event.target.value = ""
              void onFileSelected(selected)
            }}
          />
        </>
      )}

      {!online ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {t("workOrders.execution.imageOffline")}
        </p>
      ) : null}

      {fieldError != null ? (
        <p role="alert" className="text-sm text-destructive">
          {fieldError}
        </p>
      ) : null}

      {fileId != null && previewError != null ? (
        <p role="alert" className="text-sm text-destructive">
          {previewError}
        </p>
      ) : null}
    </div>
  )
}
