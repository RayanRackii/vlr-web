import {
  LoadingButton,
  type LoadingButtonProps,
} from "@/components/ui/loading-button"

type FormPrimaryButtonProps = LoadingButtonProps & {
  isValid: boolean
}

function FormPrimaryButton({
  isValid,
  loading = false,
  disabled,
  ...props
}: FormPrimaryButtonProps) {
  const blocked = !isValid || loading || Boolean(disabled)

  return (
    <LoadingButton
      {...props}
      loading={loading}
      disabled={blocked}
      aria-disabled={blocked}
    />
  )
}

export { FormPrimaryButton }
export type { FormPrimaryButtonProps }
