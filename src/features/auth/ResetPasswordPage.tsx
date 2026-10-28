import { toast } from "sonner"
import { AuthError } from "@supabase/supabase-js"
import { zodResolver } from "@hookform/resolvers/zod"
import type { TFunction } from "i18next"
import { Lock } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { AuthLayout } from "@/components/layout/AuthLayout"
import { Button } from "@/components/ui/button"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PasswordInput } from "@/components/ui/password-input"
import { iconProps } from "@/lib/icon"
import {
  createResetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/resetPasswordSchema"
import { clearCustomerSession } from "@/features/tenantPortal/services/tenantPortalService"
import { noteStaffSignIn } from "@/lib/api"
import { purgeSignedOutSessions, removeSessionKeysAsSignedOut } from "@/lib/signOutMarker"
import { supabase } from "@/lib/supabase"

function getResetErrorMessage(error: AuthError, t: TFunction): string {
  if (error.message.toLowerCase().includes("session")) {
    return t("auth.resetPassword.invalidLink")
  }

  return t("auth.resetPassword.updateFailed")
}

type GateState = "loading" | "ready" | "invalid"

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isSaved, setIsSaved] = useState(false)
  useEffect(() => {
    if (!isSaved) return
    const timer = setTimeout(() => {
      void navigate("/dashboard", { replace: true })
    }, 3000)
    return () => clearTimeout(timer)
  }, [isSaved, navigate])
  const [gate, setGate] = useState<GateState>("loading")
  const schema = useMemo(() => createResetPasswordSchema(t), [t])

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onTouched",
  })

  const watchedValues = useWatch({ control: form.control })
  const isResetValid = schema.safeParse(watchedValues).success
  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    let cancelled = false

    async function establishRecoverySession() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get("token_hash")
      const type = params.get("type")

      if (tokenHash && type === "recovery") {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        })

        if (cancelled) {
          return
        }

        if (error !== null || !data.session) {
          setGate("invalid")
          return
        }

        noteStaffSignIn()
        // Verification ran behind the sign-out barrier. Save the verified session
        // again so storage and AuthProvider receive it after the barrier is lifted.
        try {
          const { error: sessionError } = await supabase.auth.setSession(data.session)
          if (sessionError !== null) throw sessionError
        } catch {
          removeSessionKeysAsSignedOut([])
          purgeSignedOutSessions()
          void supabase.auth.stopAutoRefresh()
          if (!cancelled) setGate("invalid")
          return
        }
        if (cancelled) return

        // Drop secrets from the address bar after establishing the session.
        window.history.replaceState({}, document.title, "/reset-password")
        setGate("ready")
        return
      }

      // Legacy hash flow (Supabase verify → #access_token=…).
      const { data } = await supabase.auth.getSession()
      if (cancelled) {
        return
      }

      if (data.session) {
        noteStaffSignIn()
        setGate("ready")
        return
      }

      setGate("invalid")
    }

    void establishRecoverySession()

    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(values: ResetPasswordFormValues) {
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })

    if (error !== null) {
      form.setError("root", { message: getResetErrorMessage(error, t) })
      return
    }

    // Staff and customer sessions are exclusive: a staff sign-in ends any leftover customer one.
    clearCustomerSession()
    setIsSaved(true)
    toast.success(t("auth.resetPassword.success"))
  }

  if (gate === "loading") {
    return (
      <AuthLayout title={t("auth.resetPassword.title")}>
        <p className="text-sm text-muted-foreground">
          {t("auth.resetPassword.loading")}
        </p>
      </AuthLayout>
    )
  }

  if (gate === "invalid") {
    return (
      <AuthLayout title={t("auth.resetPassword.title")}>
        <div className="space-y-6">
          <p
            className="text-sm text-destructive dark:text-destructive-foreground"
            role="alert"
          >
            {t("auth.resetPassword.invalidLink")}
          </p>
          <Button
            type="button"
            className="h-11 w-full"
            render={<Link to="/login" />}
          >
            {t("auth.resetPassword.backToLogin")}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t("auth.resetPassword.title")}
      subtitle={t("auth.resetPassword.subtitle")}
    >
      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.resetPassword.passwordLabel")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    icon={<Lock {...iconProps("sm")} />}
                    autoComplete="new-password"
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

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("auth.resetPassword.confirmPasswordLabel")}
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    icon={<Lock {...iconProps("sm")} />}
                    autoComplete="new-password"
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

          <FormPrimaryButton
            type="submit"
            className="h-11 w-full"
            isValid={isResetValid && !isSaved}
            loading={isSubmitting}
            loadingLabel={t("auth.resetPassword.submitting")}
          >
            {t("auth.resetPassword.submit")}
          </FormPrimaryButton>
        </form>
      </Form>
    </AuthLayout>
  )
}
