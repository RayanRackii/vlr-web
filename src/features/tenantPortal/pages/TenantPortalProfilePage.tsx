import "../components/portal/portalProfile.css"

import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, CircleAlert, Lock, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useOutletContext } from "react-router-dom"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  nameInitials,
  ReadOnlyValue,
  SensitiveReadOnlyValue,
} from "@/components/profile/profileFields"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { currentCustomerSessionIdentity } from "@/features/tenantPortal/lib/customerSessionIdentity"
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
  getCustomerSessionGeneration,
  setCustomerLabel,
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
  const { primary, branding } = useOutletContext<CustomerAppOutletContext>()
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
    setCustomerLabel(next.name, next.email)
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
    const sessionGeneration = getCustomerSessionGeneration()
    const sessionIdentity = currentCustomerSessionIdentity()
    setLoading(true)
    setLoadError(null)

    try {
      const data = await fetchCustomerProfile()
      if (generation !== loadGenerationRef.current
        || sessionGeneration !== getCustomerSessionGeneration()
        || sessionIdentity !== currentCustomerSessionIdentity()) {
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

    const generation = loadGenerationRef.current
    const sessionGeneration = getCustomerSessionGeneration()
    const sessionIdentity = currentCustomerSessionIdentity()
    const isCurrent = () => generation === loadGenerationRef.current
      && sessionGeneration === getCustomerSessionGeneration()
      && sessionIdentity === currentCustomerSessionIdentity()
    setSaving(true)
    try {
      const body: UpdateCustomerProfileRequest = {
        name: values.name,
      }
      if (photoDirty) {
        body.photoUrl = photoPreview
      }

      const updated = await updateCustomerProfile(body)
      if (!isCurrent()) return
      let next = updated
      try {
        next = await fetchCustomerProfile()
      } catch {
        // PATCH already succeeded; keep that payload if GET refresh fails.
      }
      if (!isCurrent()) return
      applyProfile(next)
      toast.success(t("tenantPortal.profile.saved"))
    } catch (error) {
      if (!isCurrent()) return
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.profile.saveError"),
      )
    } finally {
      if (isCurrent()) setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageContentSkeleton rows={4} className="portal-profile-layout" />
    )
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
    <div className="portal-profile-layout">
      <header className="portal-booking-header">
        <p className="portal-eyebrow">{t("tenantPortal.profile.eyebrow")}</p>
        <h1>{t("tenantPortal.profile.title")}</h1>
        <p className="text-muted-foreground">
          {t("tenantPortal.profile.subtitle")}
        </p>
      </header>

      <Form {...form}>
        <form
          className="portal-profile-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <section
            aria-label={t("tenantPortal.fields.photo")}
            className="portal-profile-card portal-profile-identity"
          >
            <Avatar className="portal-profile-avatar">
              {photoPreview ? (
                <AvatarImage src={photoPreview} alt="" />
              ) : null}
              <AvatarFallback>{nameInitials(displayName)}</AvatarFallback>
            </Avatar>

            <div className="portal-profile-who">
              <p className="portal-profile-name">{displayName}</p>
              {email.length > 0 ? (
                <p className="portal-profile-email">{email}</p>
              ) : null}
              {photoPreview ? null : (
                <p className="portal-profile-photohint">
                  {t("tenantPortal.profile.photoNone")}
                </p>
              )}
            </div>

            <div className="portal-profile-photo-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="touch-target"
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
                  className="touch-target text-muted-foreground"
                  onClick={onRemovePhoto}
                >
                  <Trash2 aria-hidden />
                  {t("tenantPortal.profile.photoRemove")}
                </Button>
              ) : null}
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

          <section
            className="portal-profile-card"
            aria-labelledby="portal-profile-personal-heading"
          >
            <header className="portal-profile-section-head">
              <h2 id="portal-profile-personal-heading">
                {t("tenantPortal.profile.sections.personal")}
              </h2>
            </header>
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
          </section>

          {hasReadOnlyFields ? (
            <section
              className="portal-profile-card"
              aria-labelledby="portal-profile-account-heading"
            >
              <header className="portal-profile-section-head">
                <span className="portal-profile-badge">
                  <Lock aria-hidden />
                  {t("tenantPortal.profile.readOnly")}
                </span>
                <h2 id="portal-profile-account-heading">
                  {t("tenantPortal.profile.sections.account")}
                </h2>
              </header>
              <p className="portal-profile-hint">
                {t("tenantPortal.profile.accountHint", {
                  tenant: branding.displayName,
                })}
              </p>

              <div className="grid items-start gap-4 sm:grid-cols-2">
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

          <div className="portal-profile-savebar">
            <FormPrimaryButton
              type="submit"
              isValid={isProfileValid}
              loading={saving || photoProcessing}
              loadingLabel={
                photoProcessing && !saving
                  ? t("tenantPortal.profile.photoProcessing")
                  : t("tenantPortal.profile.saving")
              }
              className="touch-target w-full sm:w-auto"
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
