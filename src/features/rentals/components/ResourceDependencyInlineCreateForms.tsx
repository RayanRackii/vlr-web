import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { InlineCreateDrawerFooter, type InlineCreateOption } from "@/components/inline-create/InlineCreateSelect"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createUnit } from "@/features/assets/services/unitsService"
import { createRentalCategory } from "@/features/rentals/services/rentalResourcesService"
import { publishVisualRevision, saveVisualRevision, saveVisualTemplate } from "@/features/rentals/services/resourceVisualService"

type InlineCreateFormProps = {
  complete: (option: InlineCreateOption) => Promise<void>
  close: () => void
}

const nameSchema = z.object({ name: z.string().trim().min(1) })
type NameValues = z.infer<typeof nameSchema>

type VisualTemplateCreationProgress = {
  title: string
  templateId: string
  draftRevisionId?: string
  publishedRevisionId?: string
}

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
            const created = await createRentalCategory({ name })
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

export function InlineCreateUnitForm({ complete, close }: InlineCreateFormProps) {
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
            const created = await createUnit({ name })
            await complete({ value: created.id, label: created.name })
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("rentals.resources.inlineCreate.unitCreateError"))
          }
        })}
      >
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>{t("rentals.resources.inlineCreate.unitName")}</FormLabel>
            <FormControl><Input autoFocus autoComplete="off" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <InlineCreateDrawerFooter
          cancelLabel={t("common.cancel")}
          saveLabel={t("rentals.resources.inlineCreate.saveUnit")}
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
  const [progress, setProgress] = useState<VisualTemplateCreationProgress | null>(null)
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
            let current = progress?.title === title ? progress : null

            if (!current) {
              const template = await saveVisualTemplate({
                slug: slugify(title),
                nameI18n: { "pt-BR": title, en: title, es: title },
                descriptionI18n: { "pt-BR": null, en: null, es: null },
                tagIds: [],
                isActive: true,
                sortOrder: 0,
              })
              current = { title, templateId: template.id }
              setProgress(current)
            }

            if (!current.draftRevisionId) {
              const draft = await saveVisualRevision(current.templateId, {
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
              current = { ...current, draftRevisionId: draft.metadata.id }
              setProgress(current)
            }

            const draftRevisionId = current.draftRevisionId
            if (!draftRevisionId) {
              throw new Error("Visual template revision was not created")
            }

            if (!current.publishedRevisionId) {
              const published = await publishVisualRevision(
                current.templateId,
                draftRevisionId,
              )
              current = { ...current, publishedRevisionId: published.id }
              setProgress(current)
            }

            const publishedRevisionId = current.publishedRevisionId
            if (!publishedRevisionId) {
              throw new Error("Visual template revision was not published")
            }

            await complete({ value: publishedRevisionId, label: title })
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
