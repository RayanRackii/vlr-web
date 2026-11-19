import type { UseFormReturn } from "react-hook-form"

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { TenantEditFormValues } from "@/features/admin/schemas/adminTenantSchemas"

export type TenantStringField = {
  [K in keyof TenantEditFormValues]: TenantEditFormValues[K] extends string
    ? K
    : never
}[keyof TenantEditFormValues]

type TenantTextFieldProps = {
  form: UseFormReturn<TenantEditFormValues>
  name: TenantStringField
  label: string
  disabled?: boolean
  autoComplete?: string
  inputMode?: "text" | "email" | "tel" | "numeric"
  type?: string
  maxLength?: number
  placeholder?: string
  /** Transforms the typed value before it is stored (e.g. uppercase for the UF). */
  transform?: (value: string) => string
}

/** One labelled text input bound to the edit form (label, control and validation message). */
export function TenantTextField({
  form,
  name,
  label,
  disabled,
  autoComplete = "off",
  inputMode,
  type,
  maxLength,
  placeholder,
  transform,
}: TenantTextFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              autoComplete={autoComplete}
              inputMode={inputMode}
              type={type}
              maxLength={maxLength}
              placeholder={placeholder}
              disabled={disabled}
              {...field}
              onChange={(event) => {
                field.onChange(
                  transform ? transform(event.target.value) : event.target.value,
                )
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
