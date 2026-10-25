import { AuthError } from "@supabase/supabase-js"
import { zodResolver } from "@hookform/resolvers/zod"
import type { TFunction } from "i18next"
import { Lock } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
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

  const watchedValues = form.watch()
  const isResetValid = schema.safeParse(watchedValues).success
  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    let cancelled = false

    async function establishRecoverySession() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get("token_hash")
      const type = params.get("type")

      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        })

        if (cancelled) {
          return
        }

        if (error !== null) {
          setGate("invalid")
          return
        }

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

    void navigate("/dashboard", { replace: true })
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
          <p className="text-sm text-destructive" role="alert">
            {t("auth.resetPassword.invalidLink")}
          </p>
          <Button
            type="button"
            className="w-full"
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
            isValid={isResetValid}
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
