import { AuthError } from "@supabase/supabase-js"
import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, Lock, Mail } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { AuthLayout } from "@/components/layout/AuthLayout"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { InputWithIcon } from "@/components/ui/input-icon"
import { PasswordInput } from "@/components/ui/password-input"
import { iconProps } from "@/lib/icon"
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/loginSchema"
import {
  buildPasswordResetCompanySchema,
  type PasswordResetCompanyFormValues,
} from "@/features/auth/passwordResetCompanySchema"
import { requestPasswordReset } from "@/features/auth/passwordRecoveryService"
import { TenantPicker } from "@/features/auth/TenantPicker"
import { refreshAuthSession } from "@/features/admin/hooks/usePlatformTenantSession"
import type { StaffTenantMembership } from "@/features/users/schemas/staffTenantSchemas"
import {
  PLATFORM_ADMIN_USES_ENTER,
  StaffTenantError,
  listMyStaffTenants,
  selectMyStaffTenant,
} from "@/features/users/services/staffTenantsService"
import { toast } from "sonner"
import { resolveTenantSubdomain } from "@/features/tenantPortal/services/tenantPortalService"
import { noteStaffSignIn } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { safeStaffNextPath } from "@/lib/safeStaffNextPath"

function getLoginErrorMessage(
  error: AuthError,
  t: (key: string) => string,
): string {
  if (error.status === 429 || /too many login attempts/i.test(error.message)) {
    return t("auth.login.rateLimited")
  }

  if (error.message === "Invalid login credentials") {
    return t("auth.login.invalidCredentials")
  }

  return t("auth.login.failed")
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [resetInfo, setResetInfo] = useState<string | null>(null)
  const [resetEmail, setResetEmail] = useState<string | null>(null)
  const [showForgotEmailHint, setShowForgotEmailHint] = useState(false)
  const [picker, setPicker] = useState<{
    memberships: StaffTenantMembership[]
    initialTenantId: string
  } | null>(null)
  const [membershipError, setMembershipError] = useState(false)
  const [retryingMemberships, setRetryingMemberships] = useState(false)
  const resolvedSubdomain = resolveTenantSubdomain(location.pathname)
  const companySchema = useMemo(
    () =>
      buildPasswordResetCompanySchema({
        subdomainMin: t("auth.login.resetCompanyMin"),
        subdomainMax: t("auth.login.resetCompanyMax"),
        subdomainFormat: t("auth.login.resetCompanyFormat"),
      }),
    [t],
  )

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onTouched",
  })
  const loginEmail = useWatch({
    control: form.control,
    name: "email",
  })
  const loginPassword = useWatch({
    control: form.control,
    name: "password",
  })
  const loginValid = loginSchema.safeParse({
    email: loginEmail ?? "",
    password: loginPassword ?? "",
  }).success
  const forgotPasswordEmailValid = loginSchema
    .pick({ email: true })
    .safeParse({ email: loginEmail ?? "" }).success

  const companyForm = useForm<PasswordResetCompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { subdomain: "" },
    mode: "onTouched",
  })
  const companySubdomain = useWatch({
    control: companyForm.control,
    name: "subdomain",
  })
  const companyValid = companySchema.safeParse({
    subdomain: companySubdomain ?? "",
  }).success

  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    if (searchParams.get("forgot") === "1") {
      form.setFocus("email")
    }
    // Only react to the initial query string on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sendReset(email: string, subdomain: string) {
    setIsSendingReset(true)
    try {
      const message = await requestPasswordReset(email, subdomain)
      setResetEmail(null)
      companyForm.reset({ subdomain: "" })
      setResetInfo(message)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("auth.login.resetFailed")
      if (resetEmail) {
        companyForm.setError("root", { message })
      } else {
        form.setError("root", { message })
      }
    } finally {
      setIsSendingReset(false)
    }
  }

  async function onSubmit(values: LoginFormValues) {
    setResetInfo(null)
    noteStaffSignIn()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error !== null) {
      form.setError("root", { message: getLoginErrorMessage(error, t) })
      return
    }

    await openTenantStep()
  }

  // Accounts in more than one tenant choose where to land instead of
  // opening whichever tenant the token happens to carry.
  async function openTenantStep() {
    try {
      const list = await listMyStaffTenants()
      if (list.memberships.length > 1) {
        const current = list.memberships.some(
          (membership) => membership.tenantId === list.accessTokenTenantId,
        )
          ? (list.accessTokenTenantId ?? "")
          : ""
        setMembershipError(false)
        setPicker({ memberships: list.memberships, initialTenantId: current })
        return
      }
    } catch (error: unknown) {
      if (
        !(
          error instanceof StaffTenantError &&
          error.code === PLATFORM_ADMIN_USES_ENTER
        )
      ) {
        setMembershipError(true)
        return
      }
    }

    goAfterLogin()
  }

  async function onRetryMemberships() {
    setRetryingMemberships(true)
    try {
      await openTenantStep()
    } finally {
      setRetryingMemberships(false)
    }
  }

  function goAfterLogin() {
    void navigate(safeStaffNextPath(searchParams.get("next")) ?? "/dashboard")
  }

  async function onPickTenant(tenantId: string) {
    try {
      await selectMyStaffTenant(tenantId)
      await refreshAuthSession()
      goAfterLogin()
    } catch {
      toast.error(t("auth.invite.pickerError"))
    }
  }

  async function onForgotPassword() {
    setResetInfo(null)
    form.clearErrors("root")

    const email = form.getValues("email").trim()
    const emailValid = await form.trigger("email")
    if (!emailValid || email.length === 0) {
      setShowForgotEmailHint(true)
      form.setFocus("email")
      return
    }

    if (resolvedSubdomain) {
      await sendReset(email, resolvedSubdomain)
      return
    }

    companyForm.reset({ subdomain: "" })
    companyForm.clearErrors()
    setResetEmail(email)
  }

  async function onCompanySubmit(values: PasswordResetCompanyFormValues) {
    if (!resetEmail) {
      return
    }

    form.clearErrors("root")
    companyForm.clearErrors("root")
    await sendReset(resetEmail, values.subdomain)
  }

  if (membershipError) {
    return (
      <AuthLayout
        title={t("auth.invite.pickerTitle")}
        subtitle={t("auth.invite.membershipError")}
      >
        <LoadingButton
          type="button"
          className="h-11 w-full"
          loading={retryingMemberships}
          loadingLabel={t("auth.invite.pickerSubmitting")}
          onClick={() => {
            void onRetryMemberships()
          }}
        >
          {t("auth.invite.membershipRetry")}
        </LoadingButton>
      </AuthLayout>
    )
  }

  if (picker) {
    return (
      <AuthLayout
        title={t("auth.invite.pickerTitle")}
        subtitle={t("auth.invite.pickerBody")}
      >
        <TenantPicker
          memberships={picker.memberships}
          initialTenantId={picker.initialTenantId}
          onConfirm={onPickTenant}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={
        resetEmail ? t("auth.login.resetCompanyTitle") : t("auth.login.title")
      }
      subtitle={
        resetEmail
          ? t("auth.login.resetCompanySubtitle")
          : t("auth.login.subtitle")
      }
    >
      {resetEmail ? (
        <Form {...companyForm}>
          <form
            className="space-y-6"
            onSubmit={companyForm.handleSubmit(onCompanySubmit)}
            noValidate
          >
            <FormField
              control={companyForm.control}
              name="subdomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.login.resetCompanyLabel")}</FormLabel>
                  <FormControl>
                    <InputWithIcon
                      icon={<Building2 {...iconProps("sm")} />}
                      autoComplete="organization"
                      placeholder={t("auth.login.resetCompanyPlaceholder")}
                      className="h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("auth.login.resetCompanyHint")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {companyForm.formState.errors.root?.message ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15 dark:text-destructive-foreground"
              >
                {companyForm.formState.errors.root.message}
              </p>
            ) : null}

            <FormPrimaryButton
              type="submit"
              className="h-11 w-full"
              isValid={companyValid}
              loading={isSendingReset}
              loadingLabel={t("auth.login.resetCompanySubmitting")}
            >
              {t("auth.login.resetCompanySubmit")}
            </FormPrimaryButton>

            <LoadingButton
              type="button"
              variant="ghost"
              className="h-11 w-full"
              disabled={isSendingReset}
              onClick={() => {
                setResetEmail(null)
                companyForm.clearErrors()
              }}
            >
              {t("auth.login.resetCompanyBack")}
            </LoadingButton>
          </form>
        </Form>
      ) : null}

      {resetEmail ? null : (
      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.login.emailLabel")}</FormLabel>
                <FormControl>
                  <InputWithIcon
                    icon={<Mail {...iconProps("sm")} />}
                    type="email"
                    placeholder={t("auth.login.emailPlaceholder")}
                    autoComplete="email"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                {showForgotEmailHint && !forgotPasswordEmailValid ? (
                  <FormDescription role="status">
                    {t("auth.login.forgotEmailHint")}
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.login.passwordLabel")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    icon={<Lock {...iconProps("sm")} />}
                    placeholder={t("auth.login.passwordPlaceholder")}
                    autoComplete="current-password"
                    showLabel={t("auth.showPassword")}
                    hideLabel={t("auth.hidePassword")}
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root?.message ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15 dark:text-destructive-foreground"
            >
              {form.formState.errors.root.message}
            </p>
          ) : null}

          {resetInfo ? (
            <p
              role="status"
              className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
            >
              {resetInfo}
            </p>
          ) : null}

          <FormPrimaryButton
            type="submit"
            className="h-11 w-full"
            isValid={loginValid}
            loading={isSubmitting}
            loadingLabel={t("auth.login.submitting")}
          >
            {t("auth.login.submit")}
          </FormPrimaryButton>

          <LoadingButton
            type="button"
            variant="ghost"
            className="h-11 w-full"
            disabled={isSubmitting}
            loading={isSendingReset}
            loadingLabel={t("auth.login.forgotSubmitting")}
            onClick={() => {
              void onForgotPassword()
            }}
          >
            {t("auth.login.forgotPassword")}
          </LoadingButton>
        </form>
      </Form>
      )}
    </AuthLayout>
  )
}
