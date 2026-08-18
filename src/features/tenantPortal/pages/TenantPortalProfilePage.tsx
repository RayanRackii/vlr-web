import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useOutletContext } from "react-router-dom"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  type CustomerProfile,
  type CustomerProfileFormValues,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  fetchCustomerProfile,
  fileToCompressedDataUrl,
  updateCustomerProfile,
  type UpdateCustomerProfileRequest,
} from "@/features/tenantPortal/services/tenantPortalService"

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
}: {
  label: string
  value: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-sm text-muted-foreground">{value}</p>
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

  function applyProfile(next: CustomerProfile) {
    setProfile(next)
    form.reset({ name: next.name })
    setPhotoPreview(normalizePhotoUrl(next.photoUrl))
    setPhotoDirty(false)
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
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      setPhotoPreview(dataUrl)
      setPhotoDirty(true)
    } catch {
      toast.error(t("tenantPortal.register.photoError"))
    }
  }

  function onRemovePhoto() {
    setPhotoPreview(null)
    setPhotoDirty(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  async function onSubmit(values: CustomerProfileFormValues) {
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
    return <PageContentSkeleton rows={4} className="mx-auto w-full max-w-lg" />
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 py-6">
        <p className="text-sm text-destructive">
          {loadError ?? t("tenantPortal.profile.loadError")}
        </p>
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
  const cpf = profile.cpf?.trim() ?? ""

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
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
          className="space-y-5"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("tenantPortal.fields.photo")}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="size-16" size="lg">
                {photoPreview ? (
                  <AvatarImage src={photoPreview} alt="" />
                ) : null}
                <AvatarFallback>
                  {nameInitials(watchedName || profile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  aria-label={t("tenantPortal.profile.photoChange")}
                  onChange={(event) => {
                    void onPhotoFileChange(event.target.files?.[0])
                  }}
                />
                {photoPreview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={onRemovePhoto}
                  >
                    {t("tenantPortal.profile.photoRemove")}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("tenantPortal.profile.photoNone")}
                  </p>
                )}
              </div>
            </div>
          </div>

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

          {email.length > 0 ? (
            <ReadOnlyValue
              label={`${t("tenantPortal.fields.email")} (${t("tenantPortal.profile.readOnly")})`}
              value={email}
            />
          ) : null}

          {phone.length > 0 ? (
            <ReadOnlyValue
              label={`${t("tenantPortal.fields.phone")} (${t("tenantPortal.profile.readOnly")})`}
              value={phone}
            />
          ) : null}

          {cpf.length > 0 ? (
            <ReadOnlyValue
              label={`${t("tenantPortal.fields.cpf")} (${t("tenantPortal.profile.readOnly")})`}
              value={cpf}
            />
          ) : null}

          {address ? (
            <ReadOnlyValue
              label={`${t("tenantPortal.profile.address")} (${t("tenantPortal.profile.readOnly")})`}
              value={address}
            />
          ) : null}

          <LoadingButton
            type="submit"
            loading={saving}
            disabled={saving}
            loadingLabel={t("tenantPortal.profile.saving")}
            style={{ backgroundColor: primary }}
          >
            {t("tenantPortal.profile.save")}
          </LoadingButton>
        </form>
      </Form>
    </div>
  )
}
