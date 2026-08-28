import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useOutletContext } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

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
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  productRequestFormSchema,
  type ProductRequestFormValues,
} from "@/features/catalog/schemas/catalogSchemas"
import { createPortalProductRequest } from "@/features/catalog/services/catalogPortalService"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

export function PortalProductRequestPage() {
  const { t } = useTranslation()
  const { subdomain, primary } = useOutletContext<CustomerAppOutletContext>()
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ProductRequestFormValues>({
    resolver: zodResolver(productRequestFormSchema),
    defaultValues: { description: "", quantity: 1, note: "" },
  })

  async function onSubmit(values: ProductRequestFormValues) {
    setSubmitting(true)
    try {
      await createPortalProductRequest({
        description: values.description,
        quantity: values.quantity,
        note: values.note.trim().length > 0 ? values.note.trim() : undefined,
        files,
      })
      form.reset({ description: "", quantity: 1, note: "" })
      setFiles([])
      toast.success(t("tenantPortal.catalog.requestSubmitted"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.submitProductRequest"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        render={<Link to={tenantPortalPath(subdomain, "catalogo")} />}
      >
        {t("common.back")}
      </Button>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("tenantPortal.catalog.requestTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.catalog.requestSubtitle")}
        </p>
      </div>

      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("tenantPortal.catalog.requestDescription")}
                </FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tenantPortal.catalog.quantity")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    value={field.value}
                    onChange={(event) => {
                      field.onChange(Number(event.target.value))
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tenantPortal.catalog.requestNote")}</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("tenantPortal.catalog.requestFiles")}
            </p>
            <Input
              type="file"
              multiple
              onChange={(event) => {
                setFiles(Array.from(event.target.files ?? []))
              }}
            />
            {files.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("tenantPortal.catalog.requestFilesCount", {
                  count: files.length,
                })}
              </p>
            ) : null}
          </div>
          <LoadingButton
            type="submit"
            className="w-full"
            loading={submitting}
            loadingLabel={t("tenantPortal.catalog.submitting")}
            style={{ backgroundColor: primary }}
          >
            {t("tenantPortal.catalog.requestSubmit")}
          </LoadingButton>
        </form>
      </Form>
    </div>
  )
}
