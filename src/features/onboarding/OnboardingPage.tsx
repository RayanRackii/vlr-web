import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheck } from "lucide-react"
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
import { createTenant } from "@/features/onboarding/createTenant"
import {
  createTenantRequestSchema,
  type CreateTenantRequest,
} from "@/features/onboarding/createTenantSchema"

const SUCCESS_REDIRECT_DELAY_MS = 3000

export function OnboardingPage() {
  const navigate = useNavigate()
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const form = useForm<CreateTenantRequest>({
    resolver: zodResolver(createTenantRequestSchema),
    defaultValues: {
      legalName: "",
      taxId: "",
      tradeName: "",
      headquartersUnitName: "",
      headquartersUnitCode: "",
      adminFullName: "",
      adminEmail: "",
      adminPassword: "",
    },
  })

  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    if (!showSuccessAlert) {
      return
    }

    window.scrollTo({ top: 0, behavior: "smooth" })

    const timeoutId = window.setTimeout(() => {
      void navigate("/login")
    }, SUCCESS_REDIRECT_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [navigate, showSuccessAlert])

  async function onSubmit(values: CreateTenantRequest) {
    try {
      await createTenant(values)
      setShowSuccessAlert(true)
    } catch (error: unknown) {      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o cadastro."

      form.setError("root", { message })
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre sua empresa para começar a usar a plataforma.
        </p>
      </header>

      {showSuccessAlert ? (
        <div
          role="alert"
          className="rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-green-900 dark:text-green-300"
        >
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Ambiente criado com sucesso!</p>
              <p className="text-sm">
                Você será redirecionado para o login em alguns segundos.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <fieldset className="space-y-6" disabled={showSuccessAlert}>
          <FormField            control={form.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Razão social</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Hotel Exemplo LTDA"
                    autoComplete="organization"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CNPJ</FormLabel>
                <FormControl>
                  <Input
                    placeholder="12345678000199"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tradeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome fantasia (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Hotel Exemplo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="headquartersUnitName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidade matriz</FormLabel>
                <FormControl>
                  <Input placeholder="Matriz" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="headquartersUnitCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código da unidade (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="HQ" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adminFullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do administrador</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Admin Principal"
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adminEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail do administrador</FormLabel>
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
            name="adminPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha do administrador</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root?.message ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || showSuccessAlert}
          >
            {isSubmitting
              ? "Criando ambiente..."
              : showSuccessAlert
                ? "Ambiente criado"
                : "Criar ambiente"}
          </Button>
          </fieldset>
        </form>
      </Form>    </main>
  )
}
