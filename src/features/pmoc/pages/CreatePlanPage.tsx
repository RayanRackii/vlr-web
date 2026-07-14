import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, BookMarked, CircleCheck, LoaderCircle, Plus, Trash2 } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import { getCategories } from "@/features/assets/services/assetCategoriesService"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import {
  buildCreatePlanRequest,
  createPlanFormSchema,
  maintenanceFrequencyValues,
  mapGlobalTemplateTaskToFormTask,
  taskInputTypeValues,
  type CreatePlanFormValues,
  type TaskInputType,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import type { GlobalMaintenanceTemplate } from "@/features/pmoc/schemas/globalTemplateSchemas"
import { createPlan, getGlobalTemplates } from "@/features/pmoc/services/pmocService"
import { isAxiosError } from "@/lib/api"

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function CreatePlanPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [isLoadingLookups, setIsLoadingLookups] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [templates, setTemplates] = useState<GlobalMaintenanceTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const formSchema = useMemo(
    () =>
      createPlanFormSchema({
        unitRequired: t("pmoc.create.validation.unitRequired"),
        nameRequired: t("pmoc.create.validation.nameRequired"),
        frequencyRequired: t("pmoc.create.validation.frequencyRequired"),
        categoryRequired: t("pmoc.create.validation.categoryRequired"),
        taskTitleRequired: t("pmoc.create.validation.taskTitleRequired"),
        tasksRequired: t("pmoc.create.validation.tasksRequired"),
        numberMinRequired: t("pmoc.create.validation.numberMinRequired"),
        numberMaxRequired: t("pmoc.create.validation.numberMaxRequired"),
        numberRangeInvalid: t("pmoc.create.validation.numberRangeInvalid"),
      }),
    [t],
  )

  const form = useForm<CreatePlanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitId: "",
      name: "",
      description: "",
      frequency: "Monthly",
      assetCategoryId: "",
      isActive: true,
      tasks: [
        {
          title: "",
          inputType: "Checkbox",
          isMandatory: true,
          min: null,
          max: null,
          unit: null,
          options: undefined,
        },
      ],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "tasks",
  })

  const watchedTasks = useWatch({
    control: form.control,
    name: "tasks",
  })

  const loadLookups = useCallback(async () => {
    if (!session) {
      setLoadError(t("pmoc.create.errors.unauthorized"))
      setIsLoadingLookups(false)
      return
    }

    setIsLoadingLookups(true)
    setLoadError(null)

    try {
      const [unitsData, categoriesData] = await Promise.all([
        getUnits(),
        getCategories(),
      ])
      setUnits(unitsData)
      setCategories(categoriesData)
    } catch (error: unknown) {
      console.error("CreatePlanPage loadLookups failed", error)
      if (isAxiosError(error)) {
        console.error("CreatePlanPage loadLookups response", error.response?.data)
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.create.errors.loadLookupsFailed")
      setLoadError(message)
    } finally {
      setIsLoadingLookups(false)
    }
  }, [session, t])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  async function onSubmit(values: CreatePlanFormValues) {
    setSubmitError(null)
    setSuccessMessage(null)

    try {
      await createPlan(buildCreatePlanRequest(values))
      setSuccessMessage(t("pmoc.create.success.created"))
      void navigate("/pmoc")
    } catch (error: unknown) {
      console.error("CreatePlanPage onSubmit failed", error)
      if (isAxiosError(error)) {
        console.error("CreatePlanPage onSubmit response", error.response?.data)
      }

      const message =
        error instanceof Error
          ? error.message
          : t("pmoc.create.errors.createFailed")
      setSubmitError(message)
    }
  }

  const frequencyItems = useMemo(
    () =>
      maintenanceFrequencyValues.map((frequency) => ({
        value: frequency,
        label: t(`pmoc.frequency.${frequency}`),
      })),
    [t],
  )

  const inputTypeItems = useMemo(
    () =>
      taskInputTypeValues.map((inputType) => ({
        value: inputType,
        label: t(`pmoc.inputType.${inputType}`),
      })),
    [t],
  )

  const unitItems = useMemo(
    () =>
      units.map((unit) => ({
        value: unit.id,
        label: unit.name,
      })),
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

  const statusItems = useMemo(
    () => [
      { value: "true", label: t("pmoc.plans.status.active") },
      { value: "false", label: t("pmoc.plans.status.inactive") },
    ],
    [t],
  )

  async function openTemplateDialog() {
    setIsTemplateDialogOpen(true)
    setTemplateError(null)
    setIsLoadingTemplates(true)

    try {
      const data = await getGlobalTemplates("BR")
      setTemplates(data)
    } catch (error: unknown) {
      console.error("CreatePlanPage openTemplateDialog failed", error)
      if (isAxiosError(error)) {
        console.error(
          "CreatePlanPage openTemplateDialog response",
          error.response?.data,
        )
      }

      setTemplateError(
        error instanceof Error
          ? error.message
          : t("pmoc.templates.errors.loadFailed"),
      )
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  function handleImportTemplate(template: GlobalMaintenanceTemplate) {
    form.setValue("name", template.name)
    form.setValue("description", template.description ?? "")
    form.setValue("frequency", template.frequency)

    const importedTasks = [...template.tasks]
      .sort((a, b) => a.order - b.order)
      .map((task) =>
        mapGlobalTemplateTaskToFormTask({
          title: task.title,
          inputType: task.inputType,
          isMandatory: task.isMandatory,
          configuration: task.configuration,
        }),
      )

    replace(
      importedTasks.length > 0
        ? importedTasks
        : [
            {
              title: "",
              inputType: "Checkbox",
              isMandatory: true,
              min: null,
              max: null,
              unit: null,
              options: undefined,
            },
          ],
    )

    setIsTemplateDialogOpen(false)
    setSuccessMessage(t("pmoc.templates.importSuccess", { name: template.name }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pmoc.create.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("pmoc.create.description")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void openTemplateDialog()
            }}
          >
            <BookMarked data-icon="inline-start" />
            {t("pmoc.templates.importButton")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigate("/pmoc")
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("pmoc.create.actions.back")}
          </Button>
        </div>
      </div>

      {successMessage !== null ? (
        <div
          role="status"
          className="rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-green-900 dark:text-green-300"
        >
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      ) : null}

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {isLoadingLookups ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          {t("pmoc.create.loading")}
        </div>
      ) : (
        <Form {...form}>
          <form
            className="space-y-8"
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event)
            }}
          >
            <section className="space-y-4 rounded-xl border border-border p-4 sm:p-6">
              <div className="space-y-1">
                <h2 className="text-lg font-medium">
                  {t("pmoc.create.sections.main")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("pmoc.create.sections.mainDescription")}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t("pmoc.create.form.name")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder={t("pmoc.create.form.namePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t("pmoc.create.form.description")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t(
                            "pmoc.create.form.descriptionPlaceholder",
                          )}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                              placeholder={t(
                                "pmoc.create.form.unitPlaceholder",
                              )}
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
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.frequency")}</FormLabel>
                      <Select
                        modal={false}
                        onValueChange={field.onChange}
                        value={field.value}
                        items={frequencyItems}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t(
                                "pmoc.create.form.frequencyPlaceholder",
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {maintenanceFrequencyValues.map((frequency) => (
                            <SelectItem key={frequency} value={frequency}>
                              {t(`pmoc.frequency.${frequency}`)}
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
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.form.status")}</FormLabel>
                      <Select
                        modal={false}
                        onValueChange={(value) => {
                          field.onChange(value === "true")
                        }}
                        value={field.value ? "true" : "false"}
                        items={statusItems}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">
                            {t("pmoc.plans.status.active")}
                          </SelectItem>
                          <SelectItem value="false">
                            {t("pmoc.plans.status.inactive")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-border p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-medium">
                    {t("pmoc.create.sections.tasks")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("pmoc.create.sections.tasksDescription")}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    append({
                      title: "",
                      inputType: "Checkbox",
                      isMandatory: true,
                      min: null,
                      max: null,
                      unit: null,
                      options: undefined,
                    })
                  }}
                >
                  <Plus data-icon="inline-start" />
                  {t("pmoc.create.actions.addTask")}
                </Button>
              </div>

              {form.formState.errors.tasks?.root?.message ||
              form.formState.errors.tasks?.message ? (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.tasks.root?.message ??
                    form.formState.errors.tasks.message}
                </p>
              ) : null}

              <div className="space-y-4">
                {fields.map((field, index) => {
                  const inputType =
                    (watchedTasks?.[index]?.inputType as TaskInputType | undefined) ??
                    field.inputType

                  return (
                    <div
                      key={field.id}
                      className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium">
                          {t("pmoc.create.tasks.itemTitle", {
                            number: index + 1,
                          })}
                        </h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={fields.length <= 1}
                          aria-label={t("pmoc.create.actions.removeTask")}
                          onClick={() => {
                            remove(index)
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.title`}
                          render={({ field: titleField }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>
                                {t("pmoc.create.tasks.title")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="off"
                                  placeholder={t(
                                    "pmoc.create.tasks.titlePlaceholder",
                                  )}
                                  {...titleField}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`tasks.${index}.inputType`}
                          render={({ field: inputTypeField }) => (
                            <FormItem>
                              <FormLabel>
                                {t("pmoc.create.tasks.inputType")}
                              </FormLabel>
                              <Select
                                modal={false}
                                onValueChange={inputTypeField.onChange}
                                value={inputTypeField.value}
                                items={inputTypeItems}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {taskInputTypeValues.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {t(`pmoc.inputType.${type}`)}
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
                          name={`tasks.${index}.isMandatory`}
                          render={({ field: mandatoryField }) => (
                            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                              <FormLabel className="m-0">
                                {t("pmoc.create.tasks.isMandatory")}
                              </FormLabel>
                              <FormControl>
                                <Switch
                                  checked={mandatoryField.value}
                                  onCheckedChange={mandatoryField.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {inputType === "Number" ? (
                          <>
                            <FormField
                              control={form.control}
                              name={`tasks.${index}.min`}
                              render={({ field: minField }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t("pmoc.create.tasks.min")}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      value={
                                        minField.value == null
                                          ? ""
                                          : String(minField.value)
                                      }
                                      onChange={(event) => {
                                        minField.onChange(
                                          parseOptionalNumber(
                                            event.target.value,
                                          ),
                                        )
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`tasks.${index}.max`}
                              render={({ field: maxField }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t("pmoc.create.tasks.max")}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      value={
                                        maxField.value == null
                                          ? ""
                                          : String(maxField.value)
                                      }
                                      onChange={(event) => {
                                        maxField.onChange(
                                          parseOptionalNumber(
                                            event.target.value,
                                          ),
                                        )
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {submitError !== null ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigate("/pmoc")
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                    {t("pmoc.create.actions.saving")}
                  </>
                ) : (
                  t("pmoc.create.actions.save")
                )}
              </Button>
            </div>
          </form>
        </Form>
      )}

      <Dialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
      >
        <DialogContent className="gap-4 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("pmoc.templates.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("pmoc.templates.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {isLoadingTemplates ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t("pmoc.templates.loading")}
            </div>
          ) : null}

          {templateError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {templateError}
            </p>
          ) : null}

          {!isLoadingTemplates && templateError === null && templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("pmoc.templates.empty")}
            </p>
          ) : null}

          {!isLoadingTemplates && templates.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="w-full rounded-lg border border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => {
                    handleImportTemplate(template)
                  }}
                >
                  <p className="font-medium">{template.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("pmoc.templates.meta", {
                      jurisdiction: template.jurisdiction,
                      equipment: template.targetEquipmentType,
                      frequency: t(`pmoc.frequency.${template.frequency}`),
                      tasks: template.tasks.length,
                    })}
                  </p>
                  {template.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsTemplateDialogOpen(false)
              }}
            >
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
