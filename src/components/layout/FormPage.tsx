import type { ReactNode } from "react"

import { Page } from "@/components/layout/Page"
import type { PageHeaderProps } from "@/components/layout/PageHeader"
import { SaveBar } from "@/components/layout/SaveBar"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"

type FormPageBaseProps = {
  header: PageHeaderProps
  /** Real dirty state of the form; Save is disabled while false. */
  dirty: boolean
  saving?: boolean
  /** When false (create pages), Save is enabled by !saveDisabled alone. Default true. */
  saveRequiresDirty?: boolean
  /** Disable Save while keeping the bar visible (e.g. invalid fields). */
  saveDisabled?: boolean
  saveLabel?: string
  savingLabel?: string
  discardLabel?: string
  unsavedCount?: number
  onDiscard?: () => void
  /** Guard navigation away while dirty (default true). */
  guardUnsaved?: boolean
  className?: string
  children: ReactNode
}

type FormPageSaveProps = { onSave: () => void } | { submitFormId: string }

type FormPageStateProps =
  | { state?: "ready" | "loading"; error?: undefined; onRetry?: undefined }
  | { state: "error"; error: string; onRetry: () => void }

export type FormPageProps = FormPageBaseProps & FormPageSaveProps & FormPageStateProps

/**
 * Standard create/edit page: Page (form width) + sections + sticky SaveBar +
 * unsaved-changes guard. Pass `onSave`, or `submitFormId` to submit a form.
 */
export function FormPage(props: FormPageProps) {
  const {
    header,
    dirty,
    saving = false,
    saveRequiresDirty,
    saveDisabled,
    saveLabel,
    savingLabel,
    discardLabel,
    unsavedCount,
    onDiscard,
    guardUnsaved = true,
    className,
    children,
  } = props
  const save =
    "submitFormId" in props
      ? { submitFormId: props.submitFormId }
      : { onSave: props.onSave }
  const pageState =
    props.state === "error"
      ? { state: "error" as const, error: props.error, onRetry: props.onRetry }
      : { state: props.state }

  return (
    <Page header={header} width="form" className={className} {...pageState}>
      <UnsavedChangesGuard when={guardUnsaved && dirty && !saving} />
      {children}
      <SaveBar
        dirty={dirty}
        saving={saving}
        saveRequiresDirty={saveRequiresDirty}
        saveDisabled={saveDisabled}
        saveLabel={saveLabel}
        savingLabel={savingLabel}
        discardLabel={discardLabel}
        unsavedCount={unsavedCount}
        onDiscard={onDiscard}
        {...save}
      />
    </Page>
  )
}
