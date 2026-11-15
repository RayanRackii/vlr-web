import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShieldCheck } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Page } from "@/components/layout/Page"
import { SaveBar } from "@/components/layout/SaveBar"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FormSection } from "@/components/ui/form-layout"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  BOOKING_HORIZON_DAY_MAX,
  BOOKING_HORIZON_DAY_MIN,
  BOOKING_POLICY_DAILY_LIMIT_MAX,
  BOOKING_POLICY_DAILY_LIMIT_MIN,
  BOOKING_POLICY_TEXT_MAX_LENGTH,
  CANCEL_CUTOFF_HOURS_MAX,
  parseCancelCutoffHoursInput,
  parseHorizonDaysInput,
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
import { useCategoryBookingPolicies } from "@/features/rentals/lib/useCategoryBookingPolicies"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

/** One rule as a sentence: "before [input] after ☐ unlimited". The checkbox owns the off state. */
function SentenceRow({
  testId,
  before,
  after,
  inputLabel,
  unlimitedLabel,
  unlimited,
  onUnlimitedChange,
  disabled,
  input,
  message,
}: {
  testId: string
  before: string
  after: string
  inputLabel: string
  unlimitedLabel: string
  unlimited: boolean
  onUnlimitedChange: (unlimited: boolean) => void
  disabled: boolean
  input: (props: { label: string; disabled: boolean }) => ReactNode
  message: ReactNode
}) {
  return (
    <div className="space-y-1" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        <span>{before}</span>
        {input({ label: inputLabel, disabled: disabled || unlimited })}
        <span>{after}</span>
        <Label className="ml-1 inline-flex font-normal min-h-11 cursor-pointer items-center gap-2 text-muted-foreground">
          <Checkbox
            checked={unlimited}
            disabled={disabled}
            onChange={(event) => onUnlimitedChange(event.target.checked)}
          />
          {unlimitedLabel}
        </Label>
      </div>
      {message}
    </div>
  )
}

export function BookingPolicyPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canEdit = can("rentals.booking_policy.write") && !isTrialReadOnly
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [textFocused, setTextFocused] = useState(false)
  const [loadedCancelCutoff, setLoadedCancelCutoff] = useState<number | null | undefined>(undefined)
  const [loadedHorizon, setLoadedHorizon] = useState<
    number | null | undefined
  >(undefined)
  const [loadedValues, setLoadedValues] = useState<BookingPolicyFormValues | null>(null)
  const categoryPolicies = useCategoryBookingPolicies()

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
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isDirty: formDirty },
  } = form
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
  const dirty = formDirty || categoryPolicies.dirtyCount > 0
  const unsavedCount = (formDirty ? 1 : 0) + categoryPolicies.dirtyCount

  const setMode = (
    field: "horizonMode" | "cancelCutoffMode" | "dailyLimitEnabled",
    value: string | boolean,
  ) => setValue(field, value as never, { shouldDirty: true, shouldValidate: true })

  // What a blank category cell inherits: the general rule as currently typed.
  const unlimitedText = t("rentals.bookingPolicy.categories.noLimit")
  const inheritedDays =
    watchedHorizonMode === "days" && parseHorizonDaysInput(watchedHorizonDays) !== null
      ? watchedHorizonDays.trim()
      : unlimitedText
  const inheritedHours =
    watchedCancelCutoffMode === "hours" &&
    parseCancelCutoffHoursInput(watchedCancelCutoffHours) !== null
      ? watchedCancelCutoffHours.trim()
      : unlimitedText

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true)
      setLoadError(null)
      try {
        const policy = await getBookingPolicy()
        if (isCancelled()) {
          return
        }
        const values = bookingPolicyToFormValues(policy)
        setLoadedHorizon(policy.maxAdvanceBookingDays)
        setLoadedCancelCutoff(policy.cancelCutoffHours)
        setLoadedValues(values)
        setTextOpen(values.cancellationPolicyText.length > 0)
        reset(values)
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
    if (!schema.safeParse(values).success || categoryPolicies.invalid || saving) {
      return
    }

    setSaving(true)
    let generalError: string | null = null
    try {
      if (formDirty) {
        try {
          const updated = await replaceBookingPolicy(
            toBookingPolicyReplaceBody(values, loadedHorizon, loadedCancelCutoff),
          )
          const updatedValues = bookingPolicyToFormValues(updated)
          setLoadedHorizon(updated.maxAdvanceBookingDays)
          setLoadedCancelCutoff(updated.cancelCutoffHours)
          setLoadedValues(updatedValues)
          reset(updatedValues)
        } catch (error) {
          generalError =
            error instanceof Error
              ? error.message
              : t("rentals.bookingPolicy.saveError")
        }
      }
      const categories = await categoryPolicies.saveChanged()

      if (generalError) {
        toast.error(generalError)
      }
      if (categories.failed.length > 0) {
        toast.error(
          t("rentals.bookingPolicy.categories.saveFailed", {
            names: categories.failed.join(", "),
          }),
        )
      }
      if (!generalError && categories.failed.length === 0) {
        toast.success(t("rentals.bookingPolicy.saved"))
      }
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    if (loadedValues) {
      reset(loadedValues)
      setTextOpen(loadedValues.cancellationPolicyText.length > 0)
    }
    categoryPolicies.discard()
  }

  const fieldsDisabled = !canEdit || saving
  const pageState = loading
    ? ({ state: "loading" } as const)
    : loadError
      ? ({
          state: "error",
          error: loadError,
          onRetry: () => {
            void load()
          },
        } as const)
      : ({ state: "ready" } as const)

  return (
    <div data-testid="booking-policy-page">
      <Page
        header={{
          icon: ShieldCheck,
          title: t("nav.bookingPolicy"),
          description: t("rentals.bookingPolicy.description"),
        }}
        width="form"
        {...pageState}
      >
        <UnsavedChangesGuard when={canEdit && dirty && !saving} />

        <Form {...form}>
          <form
            id="booking-policy-form"
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSubmit(onSubmit)(event)
            }}
          >
            <FormSection title={t("rentals.bookingPolicy.generalTitle")}>
              {!canEdit ? (
                <p className="text-sm text-muted-foreground">
                  {t("rentals.bookingPolicy.readOnly")}
                </p>
              ) : null}

              <SentenceRow
                testId="rule-horizon"
                before={t("rentals.bookingPolicy.horizonBefore")}
                after={t("rentals.bookingPolicy.horizonAfter")}
                inputLabel={t("rentals.bookingPolicy.horizonDays")}
                unlimitedLabel={t("rentals.bookingPolicy.horizonUnlimited")}
                unlimited={watchedHorizonMode === "unlimited"}
                onUnlimitedChange={(unlimited) =>
                  setMode("horizonMode", unlimited ? "unlimited" : "days")
                }
                disabled={fieldsDisabled}
                input={({ label, disabled }) => (
                  <FormField
                    control={control}
                    name="horizonDays"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            className="min-h-11 w-24 tabular-nums"
                            {...field}
                            aria-label={label}
                            inputMode="numeric"
                            disabled={disabled}
                            min={BOOKING_HORIZON_DAY_MIN}
                            max={BOOKING_HORIZON_DAY_MAX}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                message={
                  watchedHorizonMode === "days" ? (
                    <FormField
                      control={control}
                      name="horizonDays"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null
                }
              />

              <SentenceRow
                testId="rule-cancel-cutoff"
                before={t("rentals.bookingPolicy.cancelCutoffBefore")}
                after={t("rentals.bookingPolicy.cancelCutoffAfter")}
                inputLabel={t("rentals.bookingPolicy.cancelCutoffHours")}
                unlimitedLabel={t("rentals.bookingPolicy.cancelCutoffNone")}
                unlimited={watchedCancelCutoffMode === "none"}
                onUnlimitedChange={(unlimited) =>
                  setMode("cancelCutoffMode", unlimited ? "none" : "hours")
                }
                disabled={fieldsDisabled}
                input={({ label, disabled }) => (
                  <FormField
                    control={control}
                    name="cancelCutoffHours"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            className="min-h-11 w-24 tabular-nums"
                            {...field}
                            value={field.value ?? ""}
                            aria-label={label}
                            inputMode="numeric"
                            disabled={disabled}
                            min={0}
                            max={CANCEL_CUTOFF_HOURS_MAX}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                message={
                  watchedCancelCutoffMode === "hours" ? (
                    <FormField
                      control={control}
                      name="cancelCutoffHours"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null
                }
              />

              <SentenceRow
                testId="rule-daily-limit"
                before={t("rentals.bookingPolicy.dailyLimitBefore")}
                after={t("rentals.bookingPolicy.dailyLimitAfter")}
                inputLabel={t("rentals.bookingPolicy.dailyLimitValue")}
                unlimitedLabel={t("rentals.bookingPolicy.dailyLimitNone")}
                unlimited={!watchedLimitEnabled}
                onUnlimitedChange={(unlimited) => setMode("dailyLimitEnabled", !unlimited)}
                disabled={fieldsDisabled}
                input={({ label, disabled }) => (
                  <FormField
                    control={control}
                    name="dailyLimit"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            className="min-h-11 w-24 tabular-nums"
                            {...field}
                            aria-label={label}
                            inputMode="numeric"
                            disabled={disabled}
                            min={BOOKING_POLICY_DAILY_LIMIT_MIN}
                            max={BOOKING_POLICY_DAILY_LIMIT_MAX}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                message={
                  watchedLimitEnabled ? (
                    <FormField
                      control={control}
                      name="dailyLimit"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null
                }
              />

              {textOpen ? (
                <FormField
                  control={control}
                  name="cancellationPolicyText"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>{t("rentals.bookingPolicy.cancellationLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          className="touch-target"
                          {...field}
                          rows={5}
                          maxLength={BOOKING_POLICY_TEXT_MAX_LENGTH}
                          disabled={fieldsDisabled}
                          placeholder={t(
                            "rentals.bookingPolicy.cancellationPlaceholder",
                          )}
                          onFocus={() => setTextFocused(true)}
                          onBlur={() => {
                            setTextFocused(false)
                            field.onBlur()
                          }}
                        />
                      </FormControl>
                      {textFocused ? (
                        <p className="tabular-nums text-xs text-muted-foreground">
                          {t("rentals.bookingPolicy.characterCount", {
                            count: watchedText.length,
                            max: BOOKING_POLICY_TEXT_MAX_LENGTH,
                          })}
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-fit px-2"
                  disabled={fieldsDisabled}
                  onClick={() => setTextOpen(true)}
                >
                  {t("rentals.bookingPolicy.addCancellationText")}
                </Button>
              )}
            </FormSection>
          </form>
        </Form>

        <CategoryBookingPolicySection
          canEdit={canEdit}
          saving={saving}
          policies={categoryPolicies}
          inheritedDays={inheritedDays}
          inheritedHours={inheritedHours}
        />

        {canEdit ? (
          <SaveBar
            dirty={dirty}
            saving={saving}
            saveDisabled={!isValid || categoryPolicies.invalid}
            saveLabel={t("rentals.bookingPolicy.save")}
            unsavedCount={unsavedCount}
            onDiscard={discard}
            onSave={() => {
              void handleSubmit(onSubmit)()
            }}
          />
        ) : null}
      </Page>
    </div>
  )
}
