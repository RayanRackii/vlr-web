import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, CircleAlert, Lock, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useOutletContext } from "react-router-dom"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  buildCustomerProfileFormSchema,
  formatCustomerDocument,
  type CustomerProfile,
  type CustomerProfileFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  fetchCustomerProfile,
  fileToCompressedDataUrl,
  updateCustomerProfile,
  type UpdateCustomerProfileRequest,
} from "@/features/tenantPortal/services/tenantPortalService"
import { cn } from "@/lib/utils"

function normalizePhotoUrl(value: string | null): string | null {
  if (value == null || value.trim().length === 0) {
    return null
  }
  return value
}

function nameInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)

  if (parts.length >= 2) {
    const first = parts[0]?.[0]
    const second = parts[1]?.[0]
    if (first && second) {
      return `${first}${second}`.toUpperCase()
    }
  }

  const compact = name.trim()
  if (compact.length === 0) {
    return "?"
  }
  return compact.slice(0, 2).toUpperCase()
}

function formatProfileAddress(profile: CustomerProfile): string | null {
  const cityState = [profile.addressCity, profile.addressState]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" / ")

  const parts = [
    profile.addressStreet,
    profile.addressNeighborhood,
    cityState,
    profile.postalCode,
  ]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return null
  }
  return parts.join(" · ")
}

function ReadOnlyValue({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm break-words">
        {value}
      </p>
    </div>
  )
}

export function TenantPortalProfilePage() {
  const { t } = useTranslation()
  const { primary } = useOutletContext<CustomerAppOutletContext>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoDirty, setPhotoDirty] = useState(false)

  const schema = useMemo(
    () =>
      buildCustomerProfileFormSchema({
        nameMin: t("tenantPortal.profile.validation.nameMin"),
        nameMax: t("tenantPortal.profile.validation.nameMax"),
      }),
    [t],
  )

  const form = useForm<CustomerProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  })

  const loadGenerationRef = useRef(0)
  const photoCompressGenerationRef = useRef(0)
  const photoProcessingRef = useRef(false)

  function applyProfile(next: CustomerProfile) {
    setProfile(next)
    form.reset({ name: next.name })
    setPhotoPreview(normalizePhotoUrl(next.photoUrl))
    setPhotoDirty(false)
    photoProcessingRef.current = false
    setPhotoProcessing(false)
    photoCompressGenerationRef.current += 1
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  async function loadProfile() {
    const generation = ++loadGenerationRef.current
    setLoading(true)
    setLoadError(null)

    try {
      const data = await fetchCustomerProfile()
      if (generation !== loadGenerationRef.current) {
        return
      }
      applyProfile(data)
    } catch (error: unknown) {
      if (generation !== loadGenerationRef.current) {
        return
      }
      setLoadError(
        error instanceof Error
          ? error.message
          : t("tenantPortal.profile.loadError"),
      )
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadProfile()
    return () => {
      loadGenerationRef.current += 1
    }
    // Apply once on mount; language change should not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on mount only
  }, [])

  async function onPhotoFileChange(file: File | undefined) {
    if (!file) {
      return
    }

    const generation = ++photoCompressGenerationRef.current
    photoProcessingRef.current = true
    setPhotoProcessing(true)
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      if (generation !== photoCompressGenerationRef.current) {
        return
      }
      setPhotoPreview(dataUrl)
      setPhotoDirty(true)
    } catch {
      if (generation !== photoCompressGenerationRef.current) {
        return
      }
      toast.error(t("tenantPortal.register.photoError"))
    } finally {
      if (generation === photoCompressGenerationRef.current) {
        photoProcessingRef.current = false
        setPhotoProcessing(false)
      }
    }
  }

  function onRemovePhoto() {
    photoCompressGenerationRef.current += 1
    photoProcessingRef.current = false
    setPhotoProcessing(false)
    setPhotoPreview(null)
    setPhotoDirty(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  async function onSubmit(values: CustomerProfileFormValues) {
    if (photoProcessingRef.current) {
      return
    }

    setSaving(true)
    try {
      const body: UpdateCustomerProfileRequest = {
        name: values.name,
      }
      if (photoDirty) {
        body.photoUrl = photoPreview
      }

      const updated = await updateCustomerProfile(body)
      let next = updated
      try {
        next = await fetchCustomerProfile()
      } catch {
        // PATCH already succeeded; keep that payload if GET refresh fails.
      }
      applyProfile(next)
      toast.success(t("tenantPortal.profile.saved"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.profile.saveError"),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageContentSkeleton rows={4} className="mx-auto w-full max-w-xl" />
  }

  if (loadError || !profile) {
    const genericLoadError = t("tenantPortal.profile.loadError")
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <CircleAlert className="size-6 text-destructive" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">{genericLoadError}</p>
          {loadError && loadError !== genericLoadError ? (
            <p className="text-sm text-muted-foreground">{loadError}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void loadProfile()
          }}
        >
          {t("tenantPortal.profile.retry")}
        </Button>
      </div>
    )
  }

  const watchedName = form.watch("name")
  const address = formatProfileAddress(profile)
  const email = profile.email?.trim() ?? ""
  const phone = profile.phone?.trim() ?? ""
  const documentLabel = formatCustomerDocument(
    profile.customerType,
    profile.document,
    profile.cpf,
  )
  const customerTypeLabel =
    profile.customerType === "Company"
      ? t("tenantPortal.fields.company")
      : t("tenantPortal.fields.individual")
  const displayName =
    watchedName.trim().length > 0 ? watchedName.trim() : profile.name
  const hasReadOnlyFields =
    email.length > 0 ||
    phone.length > 0 ||
    documentLabel !== null ||
    address !== null

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("tenantPortal.profile.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.profile.subtitle")}
        </p>
      </div>

      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <section
            aria-label={t("tenantPortal.fields.photo")}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <Avatar className="size-20">
                {photoPreview ? (
                  <AvatarImage src={photoPreview} alt="" />
                ) : null}
                <AvatarFallback className="text-xl">
                  {nameInitials(displayName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-base font-semibold">
                  {displayName}
                </p>
                {photoPreview ? null : (
                  <p className="text-xs text-muted-foreground">
                    {t("tenantPortal.profile.photoNone")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || photoProcessing}
                  onClick={() => {
                    fileInputRef.current?.click()
                  }}
                >
                  <Camera aria-hidden />
                  {t("tenantPortal.profile.photoChange")}
                </Button>
                {photoPreview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving || photoProcessing}
                    className="text-muted-foreground"
                    onClick={onRemovePhoto}
                  >
                    <Trash2 aria-hidden />
                    {t("tenantPortal.profile.photoRemove")}
                  </Button>
                ) : null}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              disabled={saving || photoProcessing}
              className="hidden"
              aria-label={t("tenantPortal.profile.photoChange")}
              onChange={(event) => {
                void onPhotoFileChange(event.target.files?.[0])
              }}
            />
          </section>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tenantPortal.fields.name")}</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    autoComplete="name"
                    disabled={saving}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {hasReadOnlyFields ? (
            <section className="space-y-4 border-t border-border pt-6">
              <div className="flex items-center gap-2">
                <Lock
                  className="size-3.5 text-muted-foreground"
                  aria-hidden
                />
                <h2 className="text-sm font-medium">
                  {t("tenantPortal.profile.sections.account")}
                </h2>
                <Badge variant="secondary" className="font-normal">
                  {t("tenantPortal.profile.readOnly")}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {email.length > 0 ? (
                  <ReadOnlyValue
                    label={t("tenantPortal.fields.email")}
                    value={email}
                  />
                ) : null}
                {phone.length > 0 ? (
                  <ReadOnlyValue
                    label={t("tenantPortal.fields.phone")}
                    value={phone}
                  />
                ) : null}
                <ReadOnlyValue
                  label={t("tenantPortal.fields.customerType")}
                  value={customerTypeLabel}
                />
                {documentLabel ? (
                  <ReadOnlyValue
                    label={
                      profile.customerType === "Company"
                        ? t("tenantPortal.fields.cnpj")
                        : t("tenantPortal.fields.cpf")
                    }
                    value={documentLabel}
                  />
                ) : null}
                {address ? (
                  <ReadOnlyValue
                    label={t("tenantPortal.profile.address")}
                    value={address}
                    className="sm:col-span-2"
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="flex justify-end">
            <LoadingButton
              type="submit"
              loading={saving || photoProcessing}
              disabled={saving || photoProcessing}
              loadingLabel={
                photoProcessing && !saving
                  ? t("tenantPortal.profile.photoProcessing")
                  : t("tenantPortal.profile.saving")
              }
              className="w-full sm:w-auto"
              style={{ backgroundColor: primary }}
            >
              {t("tenantPortal.profile.save")}
            </LoadingButton>
          </div>
        </form>
      </Form>
    </div>
  )
}
