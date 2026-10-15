import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
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
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

export function BookingPolicyPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canEdit = can("rentals.booking_policy.write") && !isTrialReadOnly
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const schema = useMemo(
    () =>
      createBookingPolicyFormSchema({
        textMax: t("rentals.bookingPolicy.validation.textMax"),
        limitRange: t("rentals.bookingPolicy.validation.limitRange"),
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
    },
  })
  const { control, handleSubmit, reset } = form
  const watchedText =
    useWatch({ control, name: "cancellationPolicyText" }) ?? ""
  const watchedLimitEnabled =
    useWatch({ control, name: "dailyLimitEnabled" }) ?? false
  const watchedLimit = useWatch({ control, name: "dailyLimit" }) ?? ""
  const isValid = schema.safeParse({
    cancellationPolicyText: watchedText,
    dailyLimitEnabled: watchedLimitEnabled,
    dailyLimit: watchedLimit,
  }).success

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true)
      setLoadError(null)
      try {
        const policy = await getBookingPolicy()
        if (isCancelled()) {
          return
        }
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
        toBookingPolicyReplaceBody(values),
      )
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
      className="mx-auto w-full max-w-3xl space-y-6"
      data-testid="booking-policy-page"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("rentals.bookingPolicy.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("rentals.bookingPolicy.description")}
        </p>
      </div>

      {loading ? <FormSkeleton fields={3} /> : null}

      {!loading && loadError ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void load()
            }}
          >
            {t("rentals.bookingPolicy.retry")}
          </Button>
        </div>
      ) : null}

      {!loading && !loadError ? (
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 rounded-lg border border-border p-4"
          >
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
                  <p className="text-xs text-muted-foreground">
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

            {canEdit ? (
              <FormPrimaryButton type="submit" isValid={isValid} loading={saving}>
                {t("rentals.bookingPolicy.save")}
              </FormPrimaryButton>
            ) : null}
          </form>
        </Form>
      ) : null}
    </div>
  )
}
