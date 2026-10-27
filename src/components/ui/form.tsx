import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext.name) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    visibleDescriptionId: itemContext.elements?.description,
    visibleMessageId: itemContext.elements?.inline ?? itemContext.elements?.message,
    hasInlineMessage: !!itemContext.elements?.inline,
    ...fieldState,
  }
}

type FormItemElement = "description" | "inline" | "message"

type FormItemContextValue = {
  id: string
  elements?: Partial<Record<FormItemElement, string>>
  registerElement?: (kind: FormItemElement, id: string | undefined) => void
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
)

/** Inline messages can also be rendered outside a FormItem. */
function FormInlineMessage(props: React.ComponentProps<"p">) {
  const { id } = React.useContext(FormItemContext)
  const messageId = props.id ?? (id ? `${id}-form-item-message` : undefined)
  useFormItemElement("inline", messageId)
  return <p {...props} id={messageId} />
}

/** Register only rendered elements so controls never describe absent messages. */
function useFormItemElement(kind: FormItemElement, id: string | undefined) {
  const { registerElement } = React.useContext(FormItemContext)
  React.useLayoutEffect(() => {
    if (!id || !registerElement) return
    registerElement(kind, id)
    return () => registerElement(kind, undefined)
  }, [id, kind, registerElement])
}

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()
  const [elements, setElements] = React.useState<Partial<Record<FormItemElement, string>>>({})
  const registerElement = React.useCallback((kind: FormItemElement, elementId: string | undefined) => {
    setElements((current) => current[kind] === elementId ? current : { ...current, [kind]: elementId })
  }, [])

  return (
    <FormItemContext.Provider value={{ id, elements, registerElement }}>
      <div
        data-slot="form-item"
        className={cn("space-y-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({
  children,
  ...props
}: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, visibleDescriptionId, visibleMessageId } =
    useFormField()

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={[visibleDescriptionId, visibleMessageId].filter(Boolean).join(" ") || undefined}
      aria-invalid={!!error || !!visibleMessageId}
      {...props}
    >
      {children}
    </Slot>
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()
  const descriptionId = props.id ?? formDescriptionId
  useFormItemElement("description", descriptionId)

  return (
    <p
      data-slot="form-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
      id={descriptionId}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId, hasInlineMessage } = useFormField()
  const body = error ? String(error.message ?? "") : props.children
  const messageId = props.id ?? formMessageId
  useFormItemElement("message", body && !hasInlineMessage ? messageId : undefined)

  if (!body || hasInlineMessage) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      className={cn("text-sm text-destructive", className)}
      {...props}
      id={messageId}
    >
      {body}
    </p>
  )
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormInlineMessage,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
}
