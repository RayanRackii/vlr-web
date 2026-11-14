import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { SaveBar } from "@/components/layout/SaveBar"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
import { cn } from "@/lib/utils"
import { LoadingButton } from "@/components/ui/loading-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type EntityTab = {
  value: string
  label: string
  /** Optional count/badge shown next to the label. */
  badge?: ReactNode
  content: ReactNode
}

type EntityPageProps = {
  breadcrumb?: ReactNode
  title: ReactNode
  /** Status badges / chips shown next to the title. */
  badges?: ReactNode
  tabs?: readonly EntityTab[]
  /** Opt in to multiple rows instead of the default horizontal scroll. */
  wrapTabs?: boolean
  /** Controlled active tab. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Content when the page has no tabs. */
  children?: ReactNode
  dirty?: boolean
  unsavedCount?: number
  onSave?: () => void
  onDiscard?: () => void
  saving?: boolean
  /** Disable the Save button while keeping the bar visible (e.g. invalid fields). */
  saveDisabled?: boolean
  saveLabel?: string
  /** Guard navigation away while dirty (default true). */
  guardUnsaved?: boolean
  className?: string
}

/**
 * Shared full-page editor layout: breadcrumb, header (title + badges + Salvar),
 * subject tabs (horizontal scroll on mobile), a sticky bottom save bar when
 * dirty, and an unsaved-changes guard. Props-driven, no data fetching.
 */
export function EntityPage({
  breadcrumb,
  title,
  badges,
  tabs,
  wrapTabs = false,
  value,
  defaultValue,
  onValueChange,
  children,
  dirty = false,
  unsavedCount = 0,
  onSave,
  onDiscard,
  saving = false,
  saveDisabled = false,
  saveLabel,
  guardUnsaved = true,
  className,
}: EntityPageProps) {
  const { t } = useTranslation()
  const guard = guardUnsaved && dirty
  const saveButton = onSave ? (
    <LoadingButton type="button" loading={saving} disabled={!dirty || saveDisabled} onClick={onSave}>
      {saveLabel ?? t("fullPage.save")}
    </LoadingButton>
  ) : null

  return (
    <div className={cn("flex flex-col gap-4 pb-24", className)}>
      <UnsavedChangesGuard when={guard} />
      {breadcrumb}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-xl font-semibold text-foreground">{title}</h1>
        {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
        {saveButton ? <div className="ml-auto">{saveButton}</div> : null}
      </header>

      {tabs && tabs.length > 0 ? (
        <Tabs value={value} defaultValue={defaultValue ?? tabs[0]?.value} onValueChange={onValueChange}>
          <div className={wrapTabs ? "min-w-0 px-1" : "-mx-1 overflow-x-auto px-1"}>
            <TabsList variant="line" className={wrapTabs ? "!h-auto w-full flex-wrap justify-start" : "w-max"}>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                  {tab.badge !== undefined ? (
                    <span className="text-xs text-muted-foreground tabular-nums">{tab.badge}</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        children
      )}

      {dirty ? (
        <SaveBar
          dirty={dirty}
          unsavedCount={unsavedCount}
          saving={saving}
          saveDisabled={saveDisabled}
          saveLabel={saveLabel}
          onDiscard={onDiscard}
          onSave={onSave}
        />
      ) : null}
    </div>
  )
}
