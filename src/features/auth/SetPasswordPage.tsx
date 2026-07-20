import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  createSetPasswordSchema,
  type SetPasswordFormValues,
} from "@/features/auth/setPasswordSchema"
import { submitInvitePassword } from "@/features/auth/setPasswordService"

export function SetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const hasToken = token.length > 0
  const [redirectTimeoutId, setRedirectTimeoutId] = useState<
    number | undefined
  >(undefined)

  const schema = useMemo(() => createSetPasswordSchema(t), [t])

  const form = useForm<SetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    return () => {
      if (redirectTimeoutId !== undefined) {
        window.clearTimeout(redirectTimeoutId)
      }
    }
  }, [redirectTimeoutId])

  async function onSubmit(values: SetPasswordFormValues) {
    if (!hasToken) {
      return
    }

    try {
      await submitInvitePassword({
        token,
        password: values.password,
      })

      toast.success(t("auth.invite.toastSuccess"))
      form.reset()

      const timeoutId = window.setTimeout(() => {
        void navigate("/login", { replace: true })
      }, 3000)

      setRedirectTimeoutId(timeoutId)
    } catch {
      toast.error(t("auth.invite.toastError"))
    }
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,hsl(var(--primary)/0.08),transparent)] p-6">
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
              {t("auth.invite.title")}
            </CardTitle>
            <CardDescription className="text-pretty text-base leading-relaxed">
              {hasToken
                ? t("auth.invite.welcome")
                : t("auth.invite.invalidLink")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!hasToken ? (
              <Button type="button" className="w-full" render={<Link to="/login" />}>
                {t("auth.invite.goToLogin")}
              </Button>
            ) : (
              <Form {...form}>
                <form
                  className="space-y-5"
                  onSubmit={form.handleSubmit(onSubmit)}
                  noValidate
                >
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("auth.invite.passwordLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder={t("auth.invite.passwordPlaceholder")}
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
                          {t("auth.invite.confirmPasswordLabel")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder={t(
                              "auth.invite.confirmPasswordPlaceholder",
                            )}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                        {t("auth.invite.submitting")}
                      </>
                    ) : (
                      t("auth.invite.submit")
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
