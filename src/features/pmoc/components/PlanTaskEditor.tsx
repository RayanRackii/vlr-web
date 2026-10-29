import { useState } from "react"
import type { Control, FieldArrayWithId, UseFormSetValue } from "react-hook-form"
import { Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  FormControl,
  FormField,
  FormItem,
  FormInlineMessage,
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
import { LiveFieldMessage } from "@/features/pmoc/components/FormValidationSummary"
import {
  taskInputTypeValues,
  type CreatePlanFormValues,
  type TaskInputType,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function PlanTaskEditor({
  control,
  fields,
  watchedTasks,
  setValue,
  onRemove,
  issueMessage,
}: {
  control: Control<CreatePlanFormValues>
  fields: FieldArrayWithId<CreatePlanFormValues, "tasks", "id">[]
  watchedTasks?: ReadonlyArray<{
    inputType?: TaskInputType
    options?: Array<string | undefined>
  }>
  setValue: UseFormSetValue<CreatePlanFormValues>
  onRemove: (index: number) => void
  issueMessage: (path: readonly (string | number)[]) => string | undefined
}) {
  const { t } = useTranslation()
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null)

  const inputTypeItems = taskInputTypeValues.map((inputType) => ({
    value: inputType,
    label: t(`pmoc.inputType.${inputType}`),
  }))

  function confirmRemoval() {
    if (pendingRemoval === null) {
      return
    }

    onRemove(pendingRemoval)
    setPendingRemoval(null)
  }

  return (
    <>
      <div className="space-y-4">
        {fields.map((field, index) => {
          const inputType =
            (watchedTasks?.[index]?.inputType as TaskInputType | undefined) ??
            field.inputType
          const options = (watchedTasks?.[index]?.options ?? []).map(
            (option) => option ?? "",
          )
          const optionsError = issueMessage(["tasks", index, "options"])
          const optionsMessageId = `${field.id}-options-message`

          return (
            <div
              key={field.id}
              className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">
                  {t("pmoc.create.tasks.itemTitle", { number: index + 1 })}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={fields.length <= 1}
                  aria-label={t("pmoc.create.actions.removeTaskNamed", {
                    number: index + 1,
                  })}
                  onClick={() => {
                    setPendingRemoval(index)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>

              <FormField
                control={control}
                name={`tasks.${index}.title`}
                render={({ field: titleField }) => (
                  <FormItem>
                    <FormLabel>{t("pmoc.create.tasks.title")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder={t("pmoc.create.tasks.titlePlaceholder")}
                        {...titleField}
                      />
                    </FormControl>
                    <LiveFieldMessage
                      message={issueMessage(["tasks", index, "title"])}
                    />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name={`tasks.${index}.inputType`}
                  render={({ field: inputTypeField }) => (
                    <FormItem>
                      <FormLabel>{t("pmoc.create.tasks.inputType")}</FormLabel>
                      <Select
                        modal={false}
                        onValueChange={(value) => {
                          inputTypeField.onChange(value)
                          inputTypeField.onBlur()
                          if (value === "SingleChoice") {
                            const current = watchedTasks?.[index]?.options
                            if (!current || current.length === 0) {
                              setValue(`tasks.${index}.options`, ["", ""], {
                                shouldDirty: true,
                                shouldTouch: true,
                              })
                            }
                          }
                        }}
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
                  control={control}
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
                      control={control}
                      name={`tasks.${index}.min`}
                      render={({ field: minField }) => (
                        <FormItem>
                          <FormLabel>{t("pmoc.create.tasks.min")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              onBlur={minField.onBlur}
                              value={
                                minField.value == null
                                  ? ""
                                  : String(minField.value)
                              }
                              onChange={(event) => {
                                minField.onChange(
                                  parseOptionalNumber(event.target.value),
                                )
                              }}
                            />
                          </FormControl>
                          <LiveFieldMessage
                            message={issueMessage(["tasks", index, "min"])}
                          />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`tasks.${index}.max`}
                      render={({ field: maxField }) => (
                        <FormItem>
                          <FormLabel>{t("pmoc.create.tasks.max")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              onBlur={maxField.onBlur}
                              value={
                                maxField.value == null
                                  ? ""
                                  : String(maxField.value)
                              }
                              onChange={(event) => {
                                maxField.onChange(
                                  parseOptionalNumber(event.target.value),
                                )
                              }}
                            />
                          </FormControl>
                          <LiveFieldMessage
                            message={issueMessage(["tasks", index, "max"])}
                          />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`tasks.${index}.unit`}
                      render={({ field: unitField }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>{t("pmoc.create.tasks.unit")}</FormLabel>
                          <FormControl>
                            <Input
                              autoComplete="off"
                              value={unitField.value ?? ""}
                              onBlur={unitField.onBlur}
                              onChange={(event) => {
                                const next = event.target.value
                                unitField.onChange(
                                  next.trim().length === 0 ? null : next,
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

                {inputType === "SingleChoice" ? (
                  <div className="space-y-3 sm:col-span-2"
                    role="group"
                    aria-label={t("pmoc.create.tasks.options")}
                    aria-describedby={optionsError ? optionsMessageId : undefined}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {t("pmoc.create.tasks.options")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-describedby={optionsError ? optionsMessageId : undefined}
                        onClick={() => {
                          setValue(
                            `tasks.${index}.options`,
                            [...options, ""],
                            { shouldDirty: true, shouldTouch: true },
                          )
                        }}
                      >
                        {t("pmoc.create.tasks.addOption")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {options.map((option, optionIndex) => (
                        <div
                          key={`${field.id}-option-${optionIndex}`}
                          className="flex items-center gap-2"
                        >
                          <Input
                            autoComplete="off"
                            aria-describedby={optionsError ? optionsMessageId : undefined}
                            aria-invalid={!!optionsError}
                            aria-label={t("pmoc.create.tasks.optionLabel", {
                              number: optionIndex + 1,
                            })}
                            value={option ?? ""}
                            onBlur={() => setValue(`tasks.${index}.options`, options, { shouldTouch: true })}
                            onChange={(event) => {
                              const next = [...options]
                              next[optionIndex] = event.target.value
                              setValue(`tasks.${index}.options`, next, {
                                shouldDirty: true,
                              })
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("pmoc.create.tasks.removeOption", {
                              number: optionIndex + 1,
                            })}
                            onClick={() => {
                              setValue(
                                `tasks.${index}.options`,
                                options.filter(
                                  (_, current) => current !== optionIndex,
                                ),
                                { shouldDirty: true, shouldTouch: true },
                              )
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {optionsError ? (
                      <FormInlineMessage id={optionsMessageId} role="alert" className="text-sm text-destructive">
                        {optionsError}
                      </FormInlineMessage>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemoval(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pmoc.create.tasks.removeConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pmoc.create.tasks.removeConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <Button type="button" variant="destructive" onClick={confirmRemoval}>
              {t("pmoc.create.actions.removeTask")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
