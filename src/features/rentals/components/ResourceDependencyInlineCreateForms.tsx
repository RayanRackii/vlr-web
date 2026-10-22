import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { InlineCreateDrawerFooter, type InlineCreateOption } from "@/components/inline-create/InlineCreateSelect"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createCategory } from "@/features/assets/services/assetCategoriesService"
import { publishVisualRevision, saveVisualRevision, saveVisualTemplate } from "@/features/rentals/services/resourceVisualService"

type InlineCreateFormProps = {
  complete: (option: InlineCreateOption) => Promise<void>
  close: () => void
}

const nameSchema = z.object({ name: z.string().trim().min(1) })
type NameValues = z.infer<typeof nameSchema>

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function InlineCreateCategoryForm({ complete, close }: InlineCreateFormProps) {
  const { t } = useTranslation()
  const form = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "" },
  })
  const values = useWatch({ control: form.control })

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async ({ name }) => {
          try {
            const created = await createCategory({ name })
            await complete({ value: created.id, label: created.name })
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("rentals.resources.createError"))
          }
        })}
      >
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>{t("rentals.resources.inlineCreate.categoryName")}</FormLabel>
            <FormControl><Input autoFocus autoComplete="off" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <InlineCreateDrawerFooter
          cancelLabel={t("common.cancel")}
          saveLabel={t("rentals.resources.inlineCreate.saveCategory")}
          isValid={nameSchema.safeParse(values).success}
          busy={form.formState.isSubmitting}
          onCancel={close}
        />
      </form>
    </Form>
  )
}

export function InlineCreateVisualTemplateForm({ complete, close }: InlineCreateFormProps) {
  const { t } = useTranslation()
  const form = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "" },
  })
  const values = useWatch({ control: form.control })

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async ({ name }) => {
          try {
            const title = name.trim()
            const template = await saveVisualTemplate({
              slug: slugify(title),
              nameI18n: { "pt-BR": title, en: title, es: title },
              descriptionI18n: { "pt-BR": null, en: null, es: null },
              tagIds: [],
              isActive: true,
              sortOrder: 0,
            })
            const draft = await saveVisualRevision(template.id, {
              floorSvg: '<rect width="100" height="60" fill="#D1D5DB"/>',
              linesSvg: null,
              netSvg: null,
              viewBox: "0 0 100 60",
              aspectRatio: 1.6667,
              defaultColor: "#4D6A92",
              defaultIcon: "layout-template",
              suggestedSlotMinutes: null,
              suggestedCapacityPeople: null,
            })
            const published = await publishVisualRevision(template.id, draft.metadata.id)
            await complete({ value: published.id, label: title })
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("resourceVisual.error"))
          }
        })}
      >
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>{t("rentals.resources.inlineCreate.templateName")}</FormLabel>
            <FormControl><Input autoFocus autoComplete="off" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <InlineCreateDrawerFooter
          cancelLabel={t("common.cancel")}
          saveLabel={t("rentals.resources.inlineCreate.saveTemplate")}
          isValid={nameSchema.safeParse(values).success}
          busy={form.formState.isSubmitting}
          onCancel={close}
        />
      </form>
    </Form>
  )
}
