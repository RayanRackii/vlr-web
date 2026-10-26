import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, CircleAlert, Lock, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useOutletContext } from "react-router-dom"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  nameInitials,
  ReadOnlyValue,
  SensitiveReadOnlyValue,
} from "@/components/profile/profileFields"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  maskBrazilianPhone,
  maskCustomerDocument,
} from "@/features/tenantPortal/lib/masks"
import { resolveCustomerPhotoUrl } from "@/features/tenantPortal/lib/profilePhoto"
import {
  buildCustomerProfileFormSchema,
  formatBrazilianPhone,
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
  const watchedName = useWatch({ control: form.control, name: "name" })
  const isProfileValid = schema.safeParse({
    name: watchedName ?? "",
  }).success

  const loadGenerationRef = useRef(0)
  const photoCompressGenerationRef = useRef(0)
  const photoProcessingRef = useRef(false)
  // Signup photos live on extraAttributes until the column is set.
  // PATCH cannot clear that attribute, so a removal in this visit stays hidden
  // after save. A later visit still shows the signup photo.
  const extraPhotoSuppressedRef = useRef(false)

  function photoFromProfile(next: CustomerProfile): string | null {
    const column = next.photoUrl?.trim() ?? ""
    if (column.length > 0) {
      extraPhotoSuppressedRef.current = false
      return column
    }
    if (extraPhotoSuppressedRef.current) {
      return null
    }
    return resolveCustomerPhotoUrl(null, next.extraAttributes)
  }

  function applyProfile(next: CustomerProfile) {
    setProfile(next)
    form.reset({ name: next.name })
    setPhotoPreview(photoFromProfile(next))
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
      extraPhotoSuppressedRef.current = false
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
    extraPhotoSuppressedRef.current = true
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
    const description =
      loadError && loadError !== genericLoadError ? loadError : undefined
    return (
      <div className="mx-auto w-full max-w-sm py-16">
        <EmptyState
          icon={CircleAlert}
          title={genericLoadError}
          description={description}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void loadProfile()
              }}
            >
              {t("tenantPortal.profile.retry")}
            </Button>
          }
        />
      </div>
    )
  }

  const address = formatProfileAddress(profile)
  const email = profile.email?.trim() ?? ""
  const phone = profile.phone?.trim() ?? ""
  const revealedPhone = formatBrazilianPhone(phone)
  const maskedPhone = maskBrazilianPhone(phone)
  const revealedDocument = formatCustomerDocument(
    profile.customerType,
    profile.document,
    profile.cpf,
  )
  const maskedDocument = maskCustomerDocument(
    profile.customerType,
    profile.document,
    profile.cpf,
  )
  const customerTypeLabel =
    profile.customerType === "Company"
      ? t("tenantPortal.fields.company")
      : t("tenantPortal.fields.individual")
  const trimmedName = (watchedName ?? "").trim()
  const displayName = trimmedName.length > 0 ? trimmedName : profile.name
  const hasReadOnlyFields =
    email.length > 0 ||
    phone.length > 0 ||
    revealedDocument !== null ||
    address !== null

  return (
    <div className="mx-auto w-full max-w-xl">
      <PageHeader
        title={t("tenantPortal.profile.title")}
        description={t("tenantPortal.profile.subtitle")}
      />

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
                  <SensitiveReadOnlyValue
                    label={t("tenantPortal.fields.phone")}
                    masked={maskedPhone}
                    revealed={revealedPhone}
                    showLabel={t("tenantPortal.profile.showSensitive", {
                      label: t("tenantPortal.fields.phone"),
                    })}
                    hideLabel={t("tenantPortal.profile.hideSensitive", {
                      label: t("tenantPortal.fields.phone"),
                    })}
                  />
                ) : null}
                <ReadOnlyValue
                  label={t("tenantPortal.fields.customerType")}
                  value={customerTypeLabel}
                />
                {revealedDocument && maskedDocument ? (
                  <SensitiveReadOnlyValue
                    label={
                      profile.customerType === "Company"
                        ? t("tenantPortal.fields.cnpj")
                        : t("tenantPortal.fields.cpf")
                    }
                    masked={maskedDocument}
                    revealed={revealedDocument}
                    showLabel={t("tenantPortal.profile.showSensitive", {
                      label:
                        profile.customerType === "Company"
                          ? t("tenantPortal.fields.cnpj")
                          : t("tenantPortal.fields.cpf"),
                    })}
                    hideLabel={t("tenantPortal.profile.hideSensitive", {
                      label:
                        profile.customerType === "Company"
                          ? t("tenantPortal.fields.cnpj")
                          : t("tenantPortal.fields.cpf"),
                    })}
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
            <FormPrimaryButton
              type="submit"
              isValid={isProfileValid}
              loading={saving || photoProcessing}
              loadingLabel={
                photoProcessing && !saving
                  ? t("tenantPortal.profile.photoProcessing")
                  : t("tenantPortal.profile.saving")
              }
              className="w-full sm:w-auto"
              style={{ backgroundColor: primary }}
            >
              {t("tenantPortal.profile.save")}
            </FormPrimaryButton>
          </div>
        </form>
      </Form>
    </div>
  )
}
