import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShieldCheck } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  BOOKING_HORIZON_DAY_MAX,
  BOOKING_HORIZON_DAY_MIN,
  BOOKING_POLICY_DAILY_LIMIT_MAX,
  BOOKING_POLICY_DAILY_LIMIT_MIN,
  BOOKING_POLICY_TEXT_MAX_LENGTH,
  bookingPolicyToFormValues,
  createBookingPolicyFormSchema,
  toBookingPolicyReplaceBody,
  type BookingPolicyFormValues,
} from "@/features/rentals/schemas/bookingPolicySchemas"
import {
  getBookingPolicy,
  replaceBookingPolicy,
} from "@/features/rentals/services/bookingPolicyService"
import { CategoryBookingPolicySection } from "@/features/rentals/components/CategoryBookingPolicySection"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { formatTenantTimeZoneLabel } from "@/features/tenantPortal/lib/tenantTimeZoneLabel"

export function BookingPolicyPage() {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canEdit = can("rentals.booking_policy.write") && !isTrialReadOnly
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadedCancelCutoff, setLoadedCancelCutoff] = useState<number | null | undefined>(undefined)
  const [loadedHorizon, setLoadedHorizon] = useState<
    number | null | undefined
  >(undefined)

  const schema = useMemo(
    () =>
      createBookingPolicyFormSchema({
        textMax: t("rentals.bookingPolicy.validation.textMax"),
        limitRange: t("rentals.bookingPolicy.validation.limitRange"),
        cancelCutoffRange: t("rentals.bookingPolicy.validation.cancelCutoffRange"),
        horizonRange: t("rentals.bookingPolicy.validation.horizonRange"),
      }),
    [t],
  )

  const form = useForm<BookingPolicyFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      cancellationPolicyText: "",
      dailyLimitEnabled: false,
      dailyLimit: "",
      horizonMode: "unlimited",
      horizonDays: "",
      cancelCutoffMode: "none",
      cancelCutoffHours: "",
    },
  })
  const { control, handleSubmit, reset } = form
  const watchedText =
    useWatch({ control, name: "cancellationPolicyText" }) ?? ""
  const watchedLimitEnabled =
    useWatch({ control, name: "dailyLimitEnabled" }) ?? false
  const watchedLimit = useWatch({ control, name: "dailyLimit" }) ?? ""
  const watchedHorizonMode =
    useWatch({ control, name: "horizonMode" }) ?? "unlimited"
  const watchedHorizonDays = useWatch({ control, name: "horizonDays" }) ?? ""
  const watchedCancelCutoffMode = useWatch({ control, name: "cancelCutoffMode" }) ?? "none"
  const watchedCancelCutoffHours = useWatch({ control, name: "cancelCutoffHours" }) ?? ""
  const isValid = schema.safeParse({
    cancellationPolicyText: watchedText,
    dailyLimitEnabled: watchedLimitEnabled,
    dailyLimit: watchedLimit,
    horizonMode: watchedHorizonMode,
    horizonDays: watchedHorizonDays,
    cancelCutoffMode: watchedCancelCutoffMode,
    cancelCutoffHours: watchedCancelCutoffHours,
  }).success
  const cancelCutoffItems = [
    { value: "none", label: t("rentals.bookingPolicy.cancelCutoffNone") },
    { value: "hours", label: t("rentals.bookingPolicy.cancelCutoffHoursMode") },
  ]
  const horizonItems = [
    {
      value: "unlimited",
      label: t("rentals.bookingPolicy.horizonUnlimited"),
    },
    { value: "days", label: t("rentals.bookingPolicy.horizonDaysMode") },
  ]

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true)
      setLoadError(null)
      try {
        const policy = await getBookingPolicy()
        if (isCancelled()) {
          return
        }
        setLoadedHorizon(policy.maxAdvanceBookingDays)
        setLoadedCancelCutoff(policy.cancelCutoffHours)
        reset(bookingPolicyToFormValues(policy))
      } catch (error) {
        if (isCancelled()) {
          return
        }
        const message =
          error instanceof Error
            ? error.message
            : t("rentals.bookingPolicy.loadError")
        setLoadError(message)
        toast.error(message)
      } finally {
        if (!isCancelled()) {
          setLoading(false)
        }
      }
    },
    [reset, t],
  )

  useEffect(() => {
    let cancelled = false
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function onSubmit(values: BookingPolicyFormValues) {
    if (!schema.safeParse(values).success || saving) {
      return
    }

    setSaving(true)
    try {
      const updated = await replaceBookingPolicy(
        toBookingPolicyReplaceBody(values, loadedHorizon, loadedCancelCutoff),
      )
      setLoadedHorizon(updated.maxAdvanceBookingDays)
      setLoadedCancelCutoff(updated.cancelCutoffHours)
      reset(bookingPolicyToFormValues(updated))
      toast.success(t("rentals.bookingPolicy.saved"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.bookingPolicy.saveError"),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="mx-auto w-full min-w-0 max-w-3xl space-y-6"
      data-testid="booking-policy-page"
    >
      <PageHeader
        icon={ShieldCheck}
        title={t("nav.bookingPolicy")}
        description={t("rentals.bookingPolicy.description")}
        className="mb-0 sm:mb-0"
      />
      <p className="text-xs text-muted-foreground" data-testid="tenant-tz-label">
        {formatTenantTimeZoneLabel(timeZoneId, i18n.language)}
      </p>

      {loading ? <FormSkeleton fields={4} /> : null}

      {!loading && loadError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{loadError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                void load()
              }}
            >
              {t("rentals.bookingPolicy.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!loading && !loadError ? (
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="min-w-0 motion-reduce:transition-none">
          <CardContent className="space-y-6">
            {!canEdit ? (
              <p className="text-sm text-muted-foreground">
                {t("rentals.bookingPolicy.readOnly")}
              </p>
            ) : null}

            <FormField
              control={control}
              name="cancellationPolicyText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("rentals.bookingPolicy.cancellationLabel")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="touch-target"
                      {...field}
                      rows={6}
                      maxLength={BOOKING_POLICY_TEXT_MAX_LENGTH}
                      disabled={!canEdit || saving}
                      placeholder={t(
                        "rentals.bookingPolicy.cancellationPlaceholder",
                      )}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("rentals.bookingPolicy.cancellationHint")}
                  </FormDescription>
                  <p className="tabular-nums text-xs text-muted-foreground">
                    {t("rentals.bookingPolicy.characterCount", {
                      count: watchedText.length,
                      max: BOOKING_POLICY_TEXT_MAX_LENGTH,
                    })}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="dailyLimitEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="space-y-1">
                    <FormLabel className="m-0">
                      {t("rentals.bookingPolicy.dailyLimitToggle")}
                    </FormLabel>
                    <FormDescription>
                      {t("rentals.bookingPolicy.dailyLimitHint")}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      disabled={!canEdit || saving}
                      aria-label={t("rentals.bookingPolicy.dailyLimitToggle")}
                      onCheckedChange={(checked) => {
                        if (typeof checked !== "boolean") {
                          return
                        }
                        field.onChange(checked)
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {watchedLimitEnabled ? (
              <FormField
                control={control}
                name="dailyLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("rentals.bookingPolicy.dailyLimitValue")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="tabular-nums"
                        {...field}
                        inputMode="numeric"
                        disabled={!canEdit || saving}
                        min={BOOKING_POLICY_DAILY_LIMIT_MIN}
                        max={BOOKING_POLICY_DAILY_LIMIT_MAX}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("rentals.bookingPolicy.validation.limitRange")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={control}
              name="horizonMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.bookingPolicy.horizonLabel")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      if (value === "unlimited" || value === "days") {
                        field.onChange(value)
                      }
                    }}
                    value={field.value}
                    items={horizonItems}
                    disabled={!canEdit || saving}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {horizonItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {watchedHorizonMode === "days"
                      ? t("rentals.bookingPolicy.horizonHintDays")
                      : t("rentals.bookingPolicy.horizonHintUnlimited")}
                  </FormDescription>
                </FormItem>
              )}
            />

            {watchedHorizonMode === "days" ? (
              <FormField
                control={control}
                name="horizonDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("rentals.bookingPolicy.horizonDays")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="tabular-nums"
                        {...field}
                        inputMode="numeric"
                        disabled={!canEdit || saving}
                        min={BOOKING_HORIZON_DAY_MIN}
                        max={BOOKING_HORIZON_DAY_MAX}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("rentals.bookingPolicy.validation.horizonRange")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={control}
              name="cancelCutoffMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rentals.bookingPolicy.cancelCutoffLabel")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      if (value === "none" || value === "hours") {
                        field.onChange(value)
                      }
                    }}
                    value={field.value}
                    items={cancelCutoffItems}
                    disabled={!canEdit || saving}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cancelCutoffItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t("rentals.bookingPolicy.cancelCutoffHint")}
                  </FormDescription>
                </FormItem>
              )}
            />

            {watchedCancelCutoffMode === "hours" ? (
              <FormField
                control={control}
                name="cancelCutoffHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("rentals.bookingPolicy.cancelCutoffHours")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="tabular-nums"
                        {...field}
                        inputMode="numeric"
                        disabled={!canEdit || saving}
                        min={0}
                        max={8760}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("rentals.bookingPolicy.validation.cancelCutoffRange")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {canEdit ? (
              <FormPrimaryButton className="w-full sm:w-auto" type="submit" isValid={isValid} loading={saving}>
                {t("rentals.bookingPolicy.save")}
              </FormPrimaryButton>
            ) : null}
          </CardContent>
          </Card>
          </form>
        </Form>
      ) : null}

      {!loading && !loadError ? <CategoryBookingPolicySection canEdit={canEdit} /> : null}
    </div>
  )
}
