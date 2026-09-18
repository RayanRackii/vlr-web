import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import type { GlobalMaintenanceTemplate } from "@/features/pmoc/schemas/globalTemplateSchemas"
import {
  buildCreateFromTemplateRequest,
  createFromTemplateFormSchema,
  type CreateFromTemplateFormValues,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import type { RegistryCategoryListItem } from "@/features/pmoc/schemas/registryCategorySchemas"
import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"
import {
  createFromTemplate,
  getTemplateById,
} from "@/features/pmoc/services/pmocService"
import { Can } from "@/features/users/permissions/Can"
import { isAxiosError } from "@/lib/api"

export function PmocTemplatePreviewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams()
  const templateId = params.templateId ?? ""

  const [template, setTemplate] = useState<GlobalMaintenanceTemplate | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isCloneOpen, setIsCloneOpen] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [isLoadingLookups, setIsLoadingLookups] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [cloneError, setCloneError] = useState<string | null>(null)

  const formSchema = useMemo(
    () =>
      createFromTemplateFormSchema({
        unitRequired: t("pmoc.create.validation.unitRequired"),
        categoryRequired: t("pmoc.create.validation.categoryRequired"),
      }),
    [t],
  )

  const form = useForm<CreateFromTemplateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitId: "",
      assetCategoryId: "",
      name: "",
    },
  })

  const watchedValues = useWatch({ control: form.control })
  const isCloneValid = formSchema.safeParse(watchedValues).success

  const loadTemplate = useCallback(async () => {
    if (!templateId) {
      setLoadError(t("pmoc.preview.errors.loadFailed"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getTemplateById(templateId)
      setTemplate(data)
    } catch (error: unknown) {
      console.error("PmocTemplatePreviewPage loadTemplate failed", error)
      if (isAxiosError(error)) {
        console.error(
          "PmocTemplatePreviewPage loadTemplate response",
          error.response?.data,
        )
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.preview.errors.loadFailed")
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [t, templateId])

  useEffect(() => {
    void loadTemplate()
  }, [loadTemplate])

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true)
    setLookupError(null)

    try {
      const [unitsData, categoriesData] = await Promise.all([
        getUnits(),
        listPlanAssetCategories(),
      ])
      setUnits(unitsData)
      setCategories(categoriesData)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.create.errors.loadLookupsFailed")
      setLookupError(message)
    } finally {
      setIsLoadingLookups(false)
    }
  }, [t])

  async function openCloneDialog() {
    setIsCloneOpen(true)
    setCloneError(null)
    form.reset({ unitId: "", assetCategoryId: "", name: "" })
    await loadLookups()
  }

  async function onClone(values: CreateFromTemplateFormValues) {
    if (!template) {
      return
    }

    setCloneError(null)

    try {
      const plan = await createFromTemplate(
        buildCreateFromTemplateRequest(template.id, values),
      )
      toast.success(t("pmoc.create.success.created"))
      setIsCloneOpen(false)
      void navigate(`/pmoc/${plan.id}`)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.preview.errors.cloneFailed")
      setCloneError(message)
      toast.error(message)
    }
  }

  const unitItems = useMemo(
    () => units.map((unit) => ({ value: unit.id, label: unit.name })),
    [units],
  )

  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  )

  const orderedTasks = useMemo(() => {
    if (!template) {
      return []
    }

    return [...template.tasks].sort((left, right) => left.order - right.order)
  }, [template])

  if (isLoading) {
    return <PageContentSkeleton rows={5} />
  }

  if (loadError !== null || template === null) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {loadError ?? t("pmoc.preview.errors.loadFailed")}
        </p>
        <Button type="button" variant="outline" onClick={() => void loadTemplate()}>
          {t("common.back")}
        </Button>
      </div>
    )
  }

  const canClone = template.status === "Published"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigate("/pmoc/biblioteca")
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("pmoc.create.actions.back")}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{template.name}</h1>
          {template.description ? (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t(`pmoc.templates.status.${template.status}`)}
          </Badge>
          {canClone ? (
            <Can permission="pmoc.plans.write">
              <Button
                type="button"
                onClick={() => {
                  void openCloneDialog()
                }}
              >
                {t("pmoc.preview.useModel")}
              </Button>
            </Can>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("pmoc.preview.deprecatedHint")}
            </p>
          )}
        </div>
      </div>

      <section className="space-y-2 rounded-xl border border-border p-4">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t("pmoc.create.form.frequency")}:{" "}
          </span>
          {t(`pmoc.frequency.${template.frequency}`)}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t("pmoc.library.version", { version: template.version })}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {t("pmoc.templates.meta", {
            jurisdiction: template.jurisdiction,
            equipment: template.targetEquipmentType,
            frequency: t(`pmoc.frequency.${template.frequency}`),
            tasks: template.tasks.length,
          })}
        </p>
      </section>

      {template.sourceReferences ? (
        <section className="space-y-2 rounded-xl border border-border p-4">
          <h2 className="text-sm font-medium">
            {t("pmoc.templates.sourceReferences")}
          </h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {template.sourceReferences}
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          {t("pmoc.plans.sections.checklist")}
        </h2>
        <ol className="divide-y rounded-xl border border-border">
          {orderedTasks.map((task) => (
            <li key={task.id} className="px-4 py-3 text-sm">
              <p className="font-medium">{task.title}</p>
              <p className="text-muted-foreground">
                {t(`pmoc.inputType.${task.inputType}`)}
                {task.isMandatory
                  ? ` · ${t("pmoc.create.tasks.isMandatory")}`
                  : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="gap-4 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("pmoc.preview.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("pmoc.preview.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {isLoadingLookups ? (
            <p className="text-sm text-muted-foreground">
              {t("pmoc.create.loading")}
            </p>
          ) : null}

          {lookupError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {lookupError}
            </p>
          ) : null}

          {!isLoadingLookups && categories.length === 0 ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {t("pmoc.create.emptyCategoriesTitle")}
              </p>
              <p className="text-muted-foreground">
                {t("pmoc.create.emptyCategoriesDescription")}
              </p>
            </div>
          ) : null}

          {!isLoadingLookups && categories.length > 0 ? (
            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  void form.handleSubmit(onClone)(event)
                }}
                noValidate
              >
                <FormField
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.unit")}</FormLabel>
                      <Select
                        modal={false}
                        onValueChange={field.onChange}
                        value={field.value}
                        items={unitItems}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t("pmoc.create.form.unitPlaceholder")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assetCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.category")}</FormLabel>
                      <Select
                        modal={false}
                        onValueChange={field.onChange}
                        value={field.value}
                        items={categoryItems}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t(
                                "pmoc.create.form.categoryPlaceholder",
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.preview.nameOptional")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder={t("pmoc.preview.namePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {cloneError !== null ? (
                  <p role="alert" className="text-sm text-destructive">
                    {cloneError}
                  </p>
                ) : null}

                <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCloneOpen(false)
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <FormPrimaryButton
                    type="submit"
                    isValid={isCloneValid}
                    loading={form.formState.isSubmitting}
                    loadingLabel={t("pmoc.create.actions.saving")}
                  >
                    {t("pmoc.preview.confirmClone")}
                  </FormPrimaryButton>
                </DialogFooter>
              </form>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
