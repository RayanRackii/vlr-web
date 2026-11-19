import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ImagePlus, Palette, Trash2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Page } from "@/components/layout/Page"
import { staffHeaderContextLabel } from "@/components/layout/staffHeaderContextLabel"
import { SaveBar } from "@/components/layout/SaveBar"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { FormSection } from "@/components/ui/form-layout"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PortalAuthHero } from "@/features/tenantPortal/components/PortalAuthLayout"
import {
  LANDING_IMAGE_ACCEPT,
  LANDING_IMAGE_RECOMMENDED,
  checkLandingImage,
} from "@/features/company/lib/landingImage"
import {
  PORTAL_HEADLINE_MAX,
  PORTAL_KICKER_MAX,
  PORTAL_SUBTITLE_MAX,
  appearanceToForm,
  createPortalAppearanceFormSchema,
  emptyPortalAppearanceForm,
  formToWriteBody,
  type PortalAppearance,
  type PortalAppearanceFormValues,
} from "@/features/company/schemas/portalAppearanceSchemas"
import {
  deletePortalLandingImage,
  getPortalAppearance,
  updatePortalAppearance,
  uploadPortalLandingImage,
} from "@/features/company/services/portalAppearanceService"
import { fetchTenantBranding, getHostTenantSubdomain } from "@/features/tenantPortal/services/tenantPortalService"
import type { TenantBranding } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { getAxiosErrorPayload, isAxiosError } from "@/lib/api"
import { cn } from "@/lib/utils"

type TextFieldName = keyof PortalAppearanceFormValues

function httpStatus(error: unknown): number | null {
  const cause = error instanceof Error ? error.cause : error
  return isAxiosError(cause) ? (cause.response?.status ?? null) : null
}

function apiMessage(error: unknown): string {
  const cause = error instanceof Error ? error.cause : error
  const payload = getAxiosErrorPayload(cause)
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error.toLowerCase()
    : ""
}

const PREVIEW_STAGE = { width: 1200, height: 750 } as const

/** Renders its children at a fixed desktop size and scales them down to the available width. */
function ScaledStage({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  useLayoutEffect(() => {
    const node = frame.current
    if (!node) return
    const update = () => { if (node.clientWidth > 0) setScale(node.clientWidth / PREVIEW_STAGE.width) }
    update()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={frame}
      data-testid="portal-hero-preview"
      className="relative aspect-[8/5] w-full overflow-hidden rounded-xl border border-border"
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: PREVIEW_STAGE.width, height: PREVIEW_STAGE.height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}

/** Configurações › Aparência do portal: landing image and texts of the customer portal login. */
export function PortalAppearancePage() {
  const { t } = useTranslation()
  const { can, currentUser } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canEdit = can("core.company.write") && !isTrialReadOnly
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [appearance, setAppearance] = useState<PortalAppearance | null>(null)
  const [loaded, setLoaded] = useState<PortalAppearanceFormValues>(emptyPortalAppearanceForm)
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploading = uploadPercent !== null
  const imageBusy = uploading || removing

  const schema = useMemo(() => createPortalAppearanceFormSchema({
    kickerTooLong: t("portalAppearance.validation.kickerTooLong", { max: PORTAL_KICKER_MAX }),
    headlineTooLong: t("portalAppearance.validation.headlineTooLong", { max: PORTAL_HEADLINE_MAX }),
    subtitleTooLong: t("portalAppearance.validation.subtitleTooLong", { max: PORTAL_SUBTITLE_MAX }),
  }), [t])

  const form = useForm<PortalAppearanceFormValues>({ resolver: zodResolver(schema), mode: "onChange", defaultValues: emptyPortalAppearanceForm })
  const { control, handleSubmit, reset, formState: { isDirty, isValid } } = form
  const values = useWatch({ control })

  const apply = useCallback((next: PortalAppearance) => {
    const formValues = appearanceToForm(next)
    setAppearance(next)
    setLoaded(formValues)
    reset(formValues)
    setLoadError(null)
    setLoading(false)
  }, [reset])

  const fail = useCallback((error: unknown) => {
    setLoadError(error instanceof Error ? error.message : t("portalAppearance.loadError"))
    setLoading(false)
  }, [t])

  const retry = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    getPortalAppearance().then(apply, fail)
  }, [apply, fail])

  useEffect(() => {
    let cancelled = false
    getPortalAppearance().then(
      (next) => { if (!cancelled) apply(next) },
      (error: unknown) => { if (!cancelled) fail(error) },
    )
    return () => { cancelled = true }
  }, [apply, fail])

  // Logo and colour for the preview; cosmetic, so a failure keeps the letter fallback.
  useEffect(() => {
    const subdomain = getHostTenantSubdomain()
    if (!subdomain) return
    let cancelled = false
    fetchTenantBranding(subdomain).then(
      (next) => { if (!cancelled) setBranding(next) },
      () => undefined,
    )
    return () => { cancelled = true }
  }, [])

  const displayName = staffHeaderContextLabel(currentUser, "") || branding?.displayName || t("portalAppearance.preview.fallbackName")

  /** 409 is the read-only trial; field problems go on the field; raw API text is never shown. */
  function handleSaveError(error: unknown) {
    const status = httpStatus(error)
    if (status === 409) {
      toast.error(t("portalAppearance.trialReadOnly"))
      return
    }
    if (status === 400) {
      const message = apiMessage(error)
      const field: TextFieldName | null = /kicker/.test(message) ? "landingKicker"
        : /headline/.test(message) ? "landingHeadline"
        : /subtitle/.test(message) ? "landingSubtitle"
        : null
      if (field) {
        const key = field === "landingKicker" ? "kickerTooLong" : field === "landingHeadline" ? "headlineTooLong" : "subtitleTooLong"
        const max = field === "landingKicker" ? PORTAL_KICKER_MAX : field === "landingHeadline" ? PORTAL_HEADLINE_MAX : PORTAL_SUBTITLE_MAX
        form.setError(field, { message: t(`portalAppearance.validation.${key}`, { max }) })
      } else {
        toast.error(t("portalAppearance.saveInvalid"))
      }
      return
    }
    toast.error(t("portalAppearance.saveError"))
  }

  function handleImageError(error: unknown, fallbackKey: string) {
    const status = httpStatus(error)
    if (status === 409) toast.error(t("portalAppearance.trialReadOnly"))
    else if (status === 413) toast.error(t("portalAppearance.image.tooLarge"))
    else if (status === 400) toast.error(t("portalAppearance.image.rejected"))
    else toast.error(t(fallbackKey))
  }

  async function onSubmit(next: PortalAppearanceFormValues) {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      const updated = await updatePortalAppearance(formToWriteBody(next))
      apply(updated)
      toast.success(t("portalAppearance.saved"))
    } catch (error) {
      handleSaveError(error)
    } finally {
      setSaving(false)
    }
  }

  async function sendFile(file: File | undefined) {
    if (!file || !canEdit || imageBusy) return
    const problem = checkLandingImage(file)
    if (problem) {
      toast.error(t(problem === "type" ? "portalAppearance.image.badType" : "portalAppearance.image.tooLarge"))
      return
    }
    setUploadPercent(0)
    try {
      const updated = await uploadPortalLandingImage(file, setUploadPercent)
      // Only the image changed: unsaved text edits stay in the form.
      setAppearance((current) => ({ ...(current ?? updated), landingImageUrl: updated.landingImageUrl }))
      toast.success(t("portalAppearance.image.uploaded"))
    } catch (error) {
      handleImageError(error, "portalAppearance.image.uploadError")
    } finally {
      setUploadPercent(null)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  async function removeImage() {
    if (!canEdit || imageBusy) return
    setRemoving(true)
    try {
      const updated = await deletePortalLandingImage()
      setAppearance((current) => ({ ...(current ?? updated), landingImageUrl: updated.landingImageUrl }))
      toast.success(t("portalAppearance.image.removed"))
    } catch (error) {
      handleImageError(error, "portalAppearance.image.removeError")
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    void sendFile(event.dataTransfer.files[0])
  }

  const imageUrl = appearance?.landingImageUrl ?? null
  const disabled = !canEdit || saving
  const pageState = loading
    ? ({ state: "loading" } as const)
    : loadError
      ? ({ state: "error", error: loadError, onRetry: retry } as const)
      : ({ state: "ready" } as const)

  function textField(name: TextFieldName, labelKey: string, max: number, multiline = false) {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => {
          const length = (values[name] ?? "").length
          return (
            <FormItem>
              <FormLabel>{t(labelKey)}</FormLabel>
              <FormControl>
                {multiline ? (
                  <Textarea {...field} rows={3} disabled={disabled} className="w-full resize-y" />
                ) : (
                  <Input {...field} disabled={disabled} className="min-h-11 w-full" />
                )}
              </FormControl>
              <div className="flex items-start justify-between gap-2">
                <FormMessage />
                <p
                  className={cn("ml-auto shrink-0 text-xs tabular-nums text-muted-foreground", length > max && "text-destructive")}
                  data-testid={`portal-counter-${name}`}
                >
                  {length}/{max}
                </p>
              </div>
            </FormItem>
          )
        }}
      />
    )
  }

  return (
    <div data-testid="portal-appearance-page">
      <Page
        header={{ icon: Palette, title: t("nav.portalAppearance"), description: t("portalAppearance.description") }}
        width="wide"
        {...pageState}
      >
        <UnsavedChangesGuard when={canEdit && isDirty && !saving} />
        <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 lg:sticky lg:top-4 lg:order-2">
            <FormSection title={t("portalAppearance.preview.title")} description={t("portalAppearance.preview.description")}>
              <div role="img" aria-label={t("portalAppearance.preview.label")}>
                <ScaledStage>
                  <PortalAuthHero
                    className="h-full"
                    headlineAsParagraph
                    branding={{
                      subdomain: branding?.subdomain ?? "",
                      displayName,
                      logoSvg: branding?.logoSvg,
                      primaryColor: branding?.primaryColor ?? null,
                      accentColor: branding?.accentColor ?? null,
                      welcomeTagline: appearance?.welcomeTagline || null,
                      landingImageUrl: imageUrl,
                      landingKicker: values.landingKicker ?? "",
                      landingHeadline: values.landingHeadline ?? "",
                      landingSubtitle: values.landingSubtitle ?? "",
                    }}
                  />
                </ScaledStage>
              </div>
            </FormSection>
          </div>

          <div className="min-w-0 space-y-5 lg:order-1">
            {!canEdit ? (
              <p className="text-sm text-muted-foreground" data-testid="portal-appearance-read-only">
                {isTrialReadOnly ? t("portalAppearance.trialReadOnly") : t("portalAppearance.readOnly")}
              </p>
            ) : null}

            <FormSection title={t("portalAppearance.image.title")} description={t("portalAppearance.image.hint", LANDING_IMAGE_RECOMMENDED)}>
              <div
                data-testid="portal-image-dropzone"
                data-dragging={dragging}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-center",
                  dragging ? "border-primary bg-primary/5" : "border-border",
                )}
                onDragOver={(event) => { if (canEdit) { event.preventDefault(); setDragging(true) } }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {imageUrl ? t("portalAppearance.image.current") : t("portalAppearance.image.empty")}
                </p>
                <p className="text-xs text-muted-foreground">{t("portalAppearance.image.formats")}</p>
                {uploading ? (
                  <div className="w-full max-w-xs" role="status" data-testid="portal-image-progress">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${uploadPercent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("portalAppearance.image.uploading", { percent: uploadPercent })}</p>
                  </div>
                ) : null}
                <input
                  ref={fileInput}
                  type="file"
                  accept={LANDING_IMAGE_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label={t("portalAppearance.image.input")}
                  data-testid="portal-image-input"
                  disabled={!canEdit || imageBusy}
                  onChange={(event) => { void sendFile(event.target.files?.[0]) }}
                />
                {canEdit ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="outline" className="min-h-11" disabled={imageBusy} onClick={() => fileInput.current?.click()}>
                      {imageUrl ? t("portalAppearance.image.replace") : t("portalAppearance.image.choose")}
                    </Button>
                    {imageUrl ? (
                      <Button type="button" variant="outline" className="min-h-11" disabled={imageBusy} onClick={() => setConfirmRemove(true)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                        {t("portalAppearance.image.remove")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </FormSection>

            <Form {...form}>
              <form
                id="portal-appearance-form"
                className="min-w-0 space-y-5"
                onSubmit={(event) => { event.preventDefault(); void handleSubmit(onSubmit)(event) }}
              >
                <FormSection title={t("portalAppearance.texts.title")} description={t("portalAppearance.texts.description")}>
                  <div className="min-w-0 space-y-4">
                    {textField("landingKicker", "portalAppearance.fields.kicker", PORTAL_KICKER_MAX)}
                    {textField("landingHeadline", "portalAppearance.fields.headline", PORTAL_HEADLINE_MAX)}
                    {textField("landingSubtitle", "portalAppearance.fields.subtitle", PORTAL_SUBTITLE_MAX, true)}
                  </div>
                </FormSection>
              </form>
            </Form>
          </div>
        </div>

        {canEdit ? (
          <SaveBar
            dirty={isDirty}
            saving={saving}
            saveDisabled={!isValid}
            saveLabel={t("common.save")}
            unsavedCount={isDirty ? 1 : 0}
            onDiscard={() => reset(loaded)}
            onSave={() => { void handleSubmit(onSubmit)() }}
          />
        ) : null}
      </Page>

      <AlertDialog open={confirmRemove} onOpenChange={(open) => { if (!removing) setConfirmRemove(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("portalAppearance.image.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("portalAppearance.image.removeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>{t("common.cancel")}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={removing} onClick={() => { void removeImage() }}>
              {t("portalAppearance.image.remove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
