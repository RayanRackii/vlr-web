import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"

const schema = z.object({ name: z.string().trim().min(1) })

export function ResourceCadastroDadosStep({ name, busy, readOnly, onSave, onDirtyChange }: {
  name: string; busy: boolean; readOnly: boolean
  onSave: (patch: { name: string }) => Promise<void>; onDirtyChange: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name } })
  const values = useWatch({ control: form.control })
  useEffect(() => { form.reset({ name }) }, [name, form])
  useEffect(() => { onDirtyChange(!readOnly && values.name !== name) }, [name, values.name, readOnly, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  return <form className="space-y-3" onSubmit={form.handleSubmit(onSave)}>
    <label className="block space-y-1 text-sm font-medium">
      {t("assistant.name")}
      <Input className="min-h-11" {...form.register("name")} disabled={readOnly || busy} required aria-invalid={!schema.safeParse(values).success} />
    </label>
    <FormPrimaryButton type="submit" className="min-h-11" isValid={schema.safeParse(values).success} loading={busy || form.formState.isSubmitting} disabled={readOnly}>{t("assistant.saveStep")}</FormPrimaryButton>
  </form>
}
