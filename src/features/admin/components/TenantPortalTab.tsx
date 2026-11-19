import { Copy, Info } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { UseFormReturn } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import type { TenantEditFormValues } from "@/features/admin/schemas/adminTenantSchemas"
import {
  tenantPortalHref,
  tenantPortalHrefPlaceholder,
} from "@/features/tenantPortal/services/tenantPortalService"
import { ROLVIX_ACCENT_COLOR, ROLVIX_PRIMARY_COLOR } from "@/lib/brandColors"

type TenantPortalTabProps = {
  form: UseFormReturn<TenantEditFormValues>
  disabled: boolean
  canEnter: boolean
  isEntering: boolean
  onEnter: () => void
}

function colorInputValue(value: string | undefined, fallback: string) {
  if (!value) return fallback
  return value.startsWith("#") ? value : `#${value}`
}

/** Renders the pasted SVG as an image (scripts never run inside <img>). */
function svgPreviewSource(svg: string): string | null {
  const trimmed = svg.trim()
  if (!trimmed.toLowerCase().includes("<svg")) return null
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`
}

type ColorFieldProps = {
  form: UseFormReturn<TenantEditFormValues>
  name: "primaryColor" | "accentColor"
  label: string
  fallback: string
  disabled: boolean
}

function ColorField({ form, name, label, fallback, disabled }: ColorFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                aria-label={label}
                className="h-9 w-12 shrink-0 cursor-pointer p-1"
                disabled={disabled}
                value={colorInputValue(field.value, fallback)}
                onChange={(event) => {
                  field.onChange(event.target.value.toUpperCase())
                }}
              />
              <Input
                autoComplete="off"
                placeholder={fallback}
                disabled={disabled}
                {...field}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/** "Portal" tab: subdomain, logo, colours and tagline, plus a pointer to the portal appearance. */
export function TenantPortalTab({
  form,
  disabled,
  canEnter,
  isEntering,
  onEnter,
}: TenantPortalTabProps) {
  const { t } = useTranslation()
  const placeholder = useMemo(() => tenantPortalHrefPlaceholder(), [])
  const subdomain = form.watch("subdomain")
  const logoSvg = form.watch("logoSvg")
  const portalUrl = subdomain ? tenantPortalHref(subdomain) : placeholder
  const logoSource = svgPreviewSource(logoSvg ?? "")

  async function copyUrl() {
    if (!subdomain) return
    const absolute = portalUrl.startsWith("/")
      ? `${window.location.origin}${portalUrl}`
      : portalUrl
    try {
      await navigator.clipboard.writeText(absolute)
      toast.success(t("admin.dashboard.actions.copyUrlDone"))
    } catch {
      toast.error(t("admin.dashboard.actions.copyUrlFailed"))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {t("admin.edit.sections.identity")}
          </CardTitle>
          <CardDescription>
            {t("admin.edit.sections.identityDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="subdomain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.wizard.fields.subdomain")}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder="acme"
                    disabled={disabled}
                    {...field}
                    onChange={(event) => {
                      field.onChange(
                        event.target.value.toLowerCase().replace(/\s+/g, ""),
                      )
                    }}
                  />
                </FormControl>
                <div className="flex min-w-0 items-center gap-2">
                  <p
                    aria-label={t("admin.edit.portal.urlPreview")}
                    className="min-w-0 flex-1 truncate rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground"
                  >
                    {portalUrl}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("admin.edit.portal.copyUrl")}
                    title={t("admin.edit.portal.copyUrl")}
                    disabled={!subdomain}
                    onClick={() => {
                      void copyUrl()
                    }}
                  >
                    <Copy className="size-4" aria-hidden />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="logoSvg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.wizard.fields.logoSvg")}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={8}
                      className="font-mono text-xs"
                      placeholder='<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
                      disabled={disabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none text-foreground">
                {t("admin.edit.portal.logoPreview")}
              </p>
              <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40 p-4">
                {logoSource ? (
                  <img
                    src={logoSource}
                    alt={t("admin.edit.portal.logoPreview")}
                    className="max-h-32 max-w-full object-contain"
                  />
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    {t("admin.edit.portal.logoPreviewEmpty")}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ColorField
              form={form}
              name="primaryColor"
              label={t("admin.wizard.fields.primaryColor")}
              fallback={ROLVIX_PRIMARY_COLOR}
              disabled={disabled}
            />
            <ColorField
              form={form}
              name="accentColor"
              label={t("admin.wizard.fields.accentColor")}
              fallback={ROLVIX_ACCENT_COLOR}
              disabled={disabled}
            />
          </div>

          <FormField
            control={form.control}
            name="welcomeTagline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.wizard.fields.welcomeTagline")}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    maxLength={120}
                    disabled={disabled}
                    placeholder={t(
                      "admin.wizard.fields.welcomeTaglinePlaceholder",
                    )}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Info
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t("admin.edit.portal.hintTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("admin.edit.portal.hintBody")}
              </p>
            </div>
          </div>
          <LoadingButton
            type="button"
            variant="outline"
            className="min-h-11 w-full shrink-0 sm:w-auto"
            disabled={!canEnter}
            loading={isEntering}
            loadingLabel={t("admin.edit.portal.entering")}
            onClick={onEnter}
          >
            {t("admin.edit.portal.enter")}
          </LoadingButton>
        </CardContent>
      </Card>
    </div>
  )
}
