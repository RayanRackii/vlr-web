import { AuthError } from "@supabase/supabase-js"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

function getResetErrorMessage(error: AuthError): string {
  if (error.message.toLowerCase().includes("session")) {
    return "Link inválido ou expirado. Solicite um novo reset na tela de login."
  }

  return "Não foi possível atualizar a senha. Tente novamente."
}

type GateState = "loading" | "ready" | "invalid"

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [gate, setGate] = useState<GateState>("loading")
  const [gateError, setGateError] = useState<string | null>(null)

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

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
          setGateError(
            "Link inválido ou expirado. Solicite um novo reset na tela de login.",
          )
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
      setGateError(
        "Link inválido ou expirado. Solicite um novo reset na tela de login.",
      )
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
      form.setError("root", { message: getResetErrorMessage(error) })
      return
    }

    void navigate("/dashboard", { replace: true })
  }

  if (gate === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 p-6">
        <p className="text-sm text-muted-foreground">Validando link…</p>
      </main>
    )
  }

  if (gate === "invalid") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Nova senha</h1>
          <p className="text-sm text-destructive" role="alert">
            {gateError}
          </p>
        </header>
        <Button type="button" render={<Link to="/login" />}>
          Voltar ao login
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Defina uma nova senha para acessar a plataforma.
        </p>
      </header>

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
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
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
                <FormLabel>Confirmar senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar senha"}
          </Button>
        </form>
      </Form>
    </main>
  )
}
