import { zodResolver } from "@hookform/resolvers/zod"
import type { TFunction } from "i18next"
import { Lock } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { z } from "zod"

import { refreshAuthSession } from "@/features/admin/hooks/usePlatformTenantSession"
import {
  EXISTING_ACCOUNT_SIGN_IN_REQUIRED,
  INVITE_ACCOUNT_MISMATCH,
  INVITE_ALREADY_ACCEPTED,
  INVITE_IDENTITY_CONFLICT,
  InviteAcceptError,
  acceptExistingAccountInvite,
  acceptNewAccountInvite,
  previewInvite,
} from "@/features/auth/inviteAcceptService"
import type { InvitePreview } from "@/features/auth/inviteSchemas"
import {
  createSetPasswordSchema,
  type SetPasswordFormValues,
} from "@/features/auth/setPasswordSchema"
import {
  PLATFORM_ADMIN_USES_ENTER,
  StaffTenantError,
  listMyStaffTenants,
  selectMyStaffTenant,
} from "@/features/users/services/staffTenantsService"
import type { StaffTenantMembership } from "@/features/users/schemas/staffTenantSchemas"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
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
import { PasswordInput } from "@/components/ui/password-input"
import { Skeleton } from "@/components/ui/skeleton"
import { iconProps } from "@/lib/icon"
import { noteStaffSignIn } from "@/lib/api"
import { supabase } from "@/lib/supabase"

type Phase =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "already-accepted" }
  | { status: "password"; preview: InvitePreview }
  | { status: "sign-in"; preview: InvitePreview }
  | {
      status: "picker"
      memberships: StaffTenantMembership[]
      initialTenantId: string
    }
  | { status: "membership-error"; invitedTenantId: string | null }

function messageForInvite(error: unknown, t: TFunction): string {
  if (!(error instanceof InviteAcceptError)) {
    return t("auth.invite.toastError")
  }

  switch (error.code) {
    case EXISTING_ACCOUNT_SIGN_IN_REQUIRED:
      return t("auth.invite.errors.existingAccount")
    case INVITE_ACCOUNT_MISMATCH:
      return t("auth.invite.errors.accountMismatch")
    case INVITE_IDENTITY_CONFLICT:
      return t("auth.invite.errors.identityConflict")
    default:
      return t("auth.invite.toastError")
  }
}

function loginErrorMessage(
  error: { message: string },
  t: TFunction,
): string {
  if (error.message === "Invalid login credentials") {
    return t("auth.login.invalidCredentials")
  }

  return t("auth.login.failed")
}

function membershipLabel(membership: StaffTenantMembership): string {
  const trade = membership.tradeName?.trim() ?? ""
  if (trade.length > 0) {
    return trade
  }

  return membership.legalName
}

function membershipSecondary(membership: StaffTenantMembership): string | null {
  const trade = membership.tradeName?.trim() ?? ""
  if (trade.length === 0 || trade === membership.legalName) {
    return null
  }

  return membership.legalName
}

export function SetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Captured once: the token is dropped from the URL after accept, and a later
  // URL change must not re-preview (or "invalidate") the consumed invite.
  const [token] = useState(() => searchParams.get("token")?.trim() ?? "")
  const hasToken = token.length > 0
  const [phase, setPhase] = useState<Phase>(
    hasToken ? { status: "loading" } : { status: "invalid" },
  )
  const [redirectTimeoutId, setRedirectTimeoutId] = useState<
    number | undefined
  >(undefined)
  const [retryingMemberships, setRetryingMemberships] = useState(false)

  useEffect(() => {
    return () => {
      if (redirectTimeoutId !== undefined) {
        window.clearTimeout(redirectTimeoutId)
      }
    }
  }, [redirectTimeoutId])

  useEffect(() => {
    // Initial phase already covers "no token" (invalid) and "loading"; the token
    // never changes after mount.
    if (token.length === 0) {
      return
    }

    let cancelled = false
    void previewInvite(token).then(
      (preview) => {
        if (cancelled) {
          return
        }

        setPhase(
          preview.existingAccount
            ? { status: "sign-in", preview }
            : { status: "password", preview },
        )
      },
      (error: unknown) => {
        if (cancelled) {
          return
        }

        if (
          error instanceof InviteAcceptError &&
          error.code === INVITE_ALREADY_ACCEPTED
        ) {
          // Reload/back after a successful accept: the membership exists.
          void supabase.auth.getSession().then(
            ({ data }) => {
              if (cancelled) {
                return
              }
              if (data.session) {
                void openMembershipStep(null)
              } else {
                setPhase({ status: "already-accepted" })
              }
            },
            () => {
              if (!cancelled) {
                setPhase({ status: "already-accepted" })
              }
            },
          )
          return
        }

        setPhase({ status: "invalid" })
      },
    )

    return () => {
      cancelled = true
    }
    // openMembershipStep only reads stable setters/navigate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function dropTokenFromUrl() {
    void navigate({ search: "" }, { replace: true })
  }

  async function openMembershipStep(invitedTenantId: string | null) {
    try {
      const list = await listMyStaffTenants()
      if (list.memberships.length > 1) {
        const invited =
          invitedTenantId !== null &&
          list.memberships.some(
            (membership) => membership.tenantId === invitedTenantId,
          )
            ? invitedTenantId
            : ""
        setPhase({
          status: "picker",
          memberships: list.memberships,
          initialTenantId: invited,
        })
        return
      }

      const only = list.memberships[0]
      if (only && only.tenantId !== list.accessTokenTenantId) {
        await selectMyStaffTenant(only.tenantId)
        await refreshAuthSession()
      }

      void navigate("/dashboard", { replace: true })
    } catch (error: unknown) {
      if (
        error instanceof StaffTenantError &&
        error.code === PLATFORM_ADMIN_USES_ENTER
      ) {
        void navigate("/dashboard", { replace: true })
        return
      }

      setPhase({ status: "membership-error", invitedTenantId })
    }
  }

  async function onCreatePassword(password: string) {
    if (phase.status !== "password") {
      return
    }

    const preview = phase.preview
    try {
      const accepted = await acceptNewAccountInvite({ token, password })
      dropTokenFromUrl()
      noteStaffSignIn()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: accepted.email,
        password,
      })
      toast.success(t("auth.invite.toastSuccess"))
      if (signInError !== null) {
        const timeoutId = window.setTimeout(() => {
          void navigate("/login", { replace: true })
        }, 1500)
        setRedirectTimeoutId(timeoutId)
        return
      }

      await openMembershipStep(preview.tenantId)
    } catch (error: unknown) {
      toast.error(messageForInvite(error, t))
      if (
        error instanceof InviteAcceptError &&
        error.code === EXISTING_ACCOUNT_SIGN_IN_REQUIRED
      ) {
        setPhase({
          status: "sign-in",
          preview: { ...preview, existingAccount: true },
        })
      }
    }
  }

  async function onExistingSignIn(
    password: string,
  ): Promise<{ message: string } | null> {
    if (phase.status !== "sign-in") {
      return null
    }

    const preview = phase.preview
    noteStaffSignIn()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: preview.email,
      password,
    })
    if (signInError !== null) {
      return { message: signInError.message }
    }

    try {
      await acceptExistingAccountInvite({ token })
      dropTokenFromUrl()
      toast.success(
        t("auth.invite.toastJoined", { tenant: preview.tenantName }),
      )
      await openMembershipStep(preview.tenantId)
      return null
    } catch (error: unknown) {
      toast.error(messageForInvite(error, t))
      return null
    }
  }

  async function onPickTenant(tenantId: string) {
    try {
      await selectMyStaffTenant(tenantId)
      await refreshAuthSession()
      void navigate("/dashboard", { replace: true })
    } catch {
      toast.error(t("auth.invite.pickerError"))
    }
  }

  async function onRetryMemberships() {
    if (phase.status !== "membership-error") {
      return
    }

    setRetryingMemberships(true)
    try {
      await openMembershipStep(phase.invitedTenantId)
    } finally {
      setRetryingMemberships(false)
    }
  }

  const title =
    phase.status === "sign-in"
      ? t("auth.invite.signInTitle")
      : phase.status === "picker"
        ? t("auth.invite.pickerTitle")
        : t("auth.invite.title")

  const description =
    phase.status === "invalid" || !hasToken
      ? t("auth.invite.invalidLink")
      : phase.status === "already-accepted"
        ? t("auth.invite.alreadyAccepted")
        : phase.status === "loading"
        ? t("auth.invite.checking")
        : phase.status === "password"
          ? t("auth.invite.welcome", { tenant: phase.preview.tenantName })
          : phase.status === "sign-in"
            ? t("auth.invite.welcomeExisting", {
                email: phase.preview.email,
                tenant: phase.preview.tenantName,
              })
            : phase.status === "membership-error"
              ? t("auth.invite.membershipError")
              : t("auth.invite.pickerBody")

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center p-6 [background:var(--brand-gradient)]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-0.5 text-2xl font-extrabold tracking-tighter text-foreground"
            aria-label={t("landing.header.brandAria")}
          >
            Rolvix
            <span className="text-primary" aria-hidden="true">
              .
            </span>
          </Link>
        </div>

        <Card className="border-border/80 shadow-lg shadow-black/5">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {title}
            </CardTitle>
            <CardDescription
              className="text-pretty text-base leading-relaxed"
              role="status"
            >
              {description}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {phase.status === "invalid" ||
            phase.status === "already-accepted" ? (
              <Button type="button" className="w-full" render={<Link to="/login" />}>
                {t("auth.invite.goToLogin")}
              </Button>
            ) : null}

            {phase.status === "loading" ? (
              <div className="space-y-3" aria-hidden="true">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : null}

            {phase.status === "password" ? (
              <NewPasswordForm onSubmit={onCreatePassword} />
            ) : null}

            {phase.status === "sign-in" ? (
              <ExistingAccountSignInForm
                email={phase.preview.email}
                onSubmit={onExistingSignIn}
              />
            ) : null}

            {phase.status === "picker" ? (
              <TenantPicker
                memberships={phase.memberships}
                initialTenantId={phase.initialTenantId}
                onConfirm={onPickTenant}
              />
            ) : null}

            {phase.status === "membership-error" ? (
              <Button
                type="button"
                className="w-full"
                disabled={retryingMemberships}
                onClick={() => {
                  void onRetryMemberships()
                }}
              >
                {retryingMemberships
                  ? t("auth.invite.pickerSubmitting")
                  : t("auth.invite.membershipRetry")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function NewPasswordForm({
  onSubmit,
}: {
  onSubmit: (password: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const schema = useMemo(() => createSetPasswordSchema(t), [t])
  const form = useForm<SetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onTouched",
  })
  const password = useWatch({ control: form.control, name: "password" })
  const confirmPassword = useWatch({
    control: form.control,
    name: "confirmPassword",
  })
  const isPasswordValid = schema.safeParse({
    password: password ?? "",
    confirmPassword: confirmPassword ?? "",
  }).success

  return (
    <Form {...form}>
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => onSubmit(values.password))}
        noValidate
      >
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.invite.passwordLabel")}</FormLabel>
              <FormControl>
                <PasswordInput
                  icon={<Lock {...iconProps("sm")} />}
                  autoComplete="new-password"
                  placeholder={t("auth.invite.passwordPlaceholder")}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.invite.confirmPasswordLabel")}</FormLabel>
              <FormControl>
                <PasswordInput
                  icon={<Lock {...iconProps("sm")} />}
                  autoComplete="new-password"
                  placeholder={t("auth.invite.confirmPasswordPlaceholder")}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormPrimaryButton
          type="submit"
          className="w-full"
          isValid={isPasswordValid}
          loading={form.formState.isSubmitting}
          loadingLabel={t("auth.invite.submitting")}
        >
          {t("auth.invite.submit")}
        </FormPrimaryButton>
      </form>
    </Form>
  )
}

function ExistingAccountSignInForm({
  email,
  onSubmit,
}: {
  email: string
  onSubmit: (password: string) => Promise<{ message: string } | null>
}) {
  const { t } = useTranslation()
  const schema = useMemo(
    () =>
      z.object({
        password: z
          .string()
          .min(1, t("auth.login.validation.passwordRequired")),
      }),
    [t],
  )
  const form = useForm<{ password: string }>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
    mode: "onTouched",
  })
  const password = useWatch({ control: form.control, name: "password" })
  const isValid = schema.safeParse({ password: password ?? "" }).success

  return (
    <Form {...form}>
      <form
        className="space-y-5"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          form.clearErrors("root")
          const signInError = await onSubmit(values.password)
          if (signInError !== null) {
            form.setError("root", {
              message: loginErrorMessage(signInError, t),
            })
          }
        })}
      >
        <div className="space-y-2">
          <Label htmlFor="invite-existing-email">
            {t("auth.login.emailLabel")}
          </Label>
          <Input
            id="invite-existing-email"
            type="email"
            autoComplete="username"
            readOnly
            value={email}
          />
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.invite.existingPasswordLabel")}</FormLabel>
              <FormControl>
                <PasswordInput
                  icon={<Lock {...iconProps("sm")} />}
                  autoComplete="current-password"
                  placeholder={t("auth.invite.existingPasswordPlaceholder")}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
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
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <FormPrimaryButton
          type="submit"
          className="w-full"
          isValid={isValid}
          loading={form.formState.isSubmitting}
          loadingLabel={t("auth.invite.signInSubmitting")}
        >
          {t("auth.invite.signInSubmit")}
        </FormPrimaryButton>
      </form>
    </Form>
  )
}

function TenantPicker({
  memberships,
  initialTenantId,
  onConfirm,
}: {
  memberships: StaffTenantMembership[]
  initialTenantId: string
  onConfirm: (tenantId: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId)
  const [submitting, setSubmitting] = useState(false)
  const selected = memberships.some(
    (membership) => membership.tenantId === selectedTenantId,
  )

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!selected || submitting) {
          return
        }

        setSubmitting(true)
        void onConfirm(selectedTenantId).finally(() => {
          setSubmitting(false)
        })
      }}
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">{t("auth.invite.pickerTitle")}</legend>
        {memberships.map((membership) => {
          const label = membershipLabel(membership)
          const secondary = membershipSecondary(membership)
          return (
            <label
              key={membership.tenantId}
              className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <input
                type="radio"
                name="invite-tenant"
                className="mt-0.5 size-4 accent-primary"
                value={membership.tenantId}
                checked={selectedTenantId === membership.tenantId}
                disabled={submitting}
                onChange={() => {
                  setSelectedTenantId(membership.tenantId)
                }}
              />
              <span>
                <span className="block font-medium">{label}</span>
                {secondary ? (
                  <span className="block text-muted-foreground">{secondary}</span>
                ) : null}
              </span>
            </label>
          )
        })}
      </fieldset>

      <FormPrimaryButton
        type="submit"
        className="w-full"
        isValid={selected}
        loading={submitting}
        loadingLabel={t("auth.invite.pickerSubmitting")}
      >
        {t("auth.invite.pickerSubmit")}
      </FormPrimaryButton>
    </form>
  )
}
