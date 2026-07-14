import { AuthError } from "@supabase/supabase-js"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"

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
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/loginSchema"
import { supabase } from "@/lib/supabase"

function getLoginErrorMessage(error: AuthError): string {
  if (error.message === "Invalid login credentials") {
    return "E-mail ou senha inválidos."
  }

  return "Não foi possível entrar. Tente novamente."
}

export function LoginPage() {
  const navigate = useNavigate()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: LoginFormValues) {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error !== null) {
      form.setError("root", { message: getLoginErrorMessage(error) })
      return
    }

    void navigate("/dashboard")
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
        <p className="text-sm text-muted-foreground">
          Entre com suas credenciais para acessar a plataforma.
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="admin@hotel.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Sua senha"
                    autoComplete="current-password"
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
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Form>
    </main>
  )
}
