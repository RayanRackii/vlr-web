import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CustomerGrantPicker } from "@/features/catalog/components/productWizard/CustomerGrantPicker"
import { useStepSubmit } from "@/features/assistant/stepSubmit"
import { isSameTabPrimaryClick } from "@/features/catalog/components/productWizard/plainClick"
import { productGroupDeepLink } from "@/features/catalog/components/productWizard/wizardSteps"
import type { CatalogProductVisibility, CustomerGroup } from "@/features/catalog/schemas/catalogSchemas"
import {
  addCustomerGroupMembers,
  putCatalogProductAccess,
} from "@/features/catalog/services/catalogService"
import type { TenantCustomer } from "@/features/users/schemas/userSchemas"
import { listTenantCustomers } from "@/features/users/services/usersService"

type ProductWizardAccessStepProps = {
  productId: string
  visibility: CatalogProductVisibility
  customerIds: readonly string[]
  /** Names of the granted customers, keyed by id (from the access response). */
  customerNames?: Record<string, string>
  groupIds: readonly string[]
  groups: readonly CustomerGroup[]
  wizardPath: string
  readOnly: boolean
  canSearchCustomers: boolean
  onSaved: () => void | Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  onSavingChange?: (saving: boolean) => void
  /** Return false to stay. Only plain same-tab clicks ask. */
  beforeNavigate?: () => boolean
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  const ids = new Set(left)
  return right.every((id) => ids.has(id))
}

export function ProductWizardAccessStep({
  productId,
  visibility: initialVisibility,
  customerIds: initialCustomerIds,
  customerNames = {},
  groupIds: initialGroupIds,
  groups,
  wizardPath,
  readOnly,
  canSearchCustomers,
  onSaved,
  onDirtyChange,
  onSavingChange,
  beforeNavigate,
}: ProductWizardAccessStepProps) {
  const { t } = useTranslation()
  const [visibility, setVisibility] = useState<CatalogProductVisibility>(initialVisibility)
  const [groupIds, setGroupIds] = useState<string[]>([...initialGroupIds])
  const [customerIds, setCustomerIds] = useState<string[]>([...initialCustomerIds])
  const [savedCustomerIds, setSavedCustomerIds] = useState<string[]>([...initialCustomerIds])
  const [pickedNames, setPickedNames] = useState<Record<string, string>>({})
  const [savedVisibility, setSavedVisibility] = useState(initialVisibility)
  const [savedGroupIds, setSavedGroupIds] = useState<string[]>([...initialGroupIds])
  const [queries, setQueries] = useState<Record<string, string>>({})
  const [matches, setMatches] = useState<Record<string, TenantCustomer[]>>({})
  const [searched, setSearched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const dirty = visibility !== savedVisibility || !sameIds(groupIds, savedGroupIds) || !sameIds(customerIds, savedCustomerIds)
  const draftRef = useRef({ visibility, groupIds, customerIds })

  useEffect(() => {
    draftRef.current = { visibility, groupIds, customerIds }
  }, [visibility, groupIds, customerIds])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])
  useEffect(() => () => onSavingChange?.(false), [onSavingChange])

  const emptyGroups = useMemo(
    () => groups.filter((group) => groupIds.includes(group.id) && group.memberCustomerIds.length === 0),
    [groupIds, groups],
  )

  async function save(): Promise<boolean> {
    if (readOnly || saving) {
      return false
    }
    const sentVisibility = visibility
    const sentGroupIds = [...groupIds]
    const sentCustomerIds = [...customerIds]
    setSaving(true)
    setSaveError(null)
    onSavingChange?.(true)
    try {
      await putCatalogProductAccess(productId, {
        visibility: sentVisibility,
        customerIds: sentCustomerIds,
        groupIds: sentGroupIds,
      })
      const current = draftRef.current
      if (current.visibility === sentVisibility && sameIds(current.groupIds, sentGroupIds) && sameIds(current.customerIds, sentCustomerIds)) {
        setSavedVisibility(sentVisibility)
        setSavedGroupIds(sentGroupIds)
        setSavedCustomerIds(sentCustomerIds)
      }
      toast.success(t("catalog.productWizard.accessSaved"))
      await onSaved()
      return true
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t("catalog.customerGroups.errors.saveAccess")
      setSaveError(message)
      toast.error(message)
      return false
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  // Inside the cadastro shell the footer saves; the step's own Save button is hidden.
  const shellDrivesSave = useStepSubmit(async () => {
    if (readOnly || !dirty) {
      return true
    }
    return save()
  })

  const grantCount = groupIds.length + customerIds.length
  const locked = readOnly || saving

  function addCustomer(customer: TenantCustomer) {
    setPickedNames((current) => ({ ...current, [customer.id]: customer.name }))
    setCustomerIds((current) => current.includes(customer.id) ? current : [...current, customer.id])
  }

  function removeCustomer(id: string) {
    setCustomerIds((current) => current.filter((item) => item !== id))
  }

  const nameOf = (id: string) => pickedNames[id] ?? customerNames[id]
  const missingNames = customerIds.some((id) => !nameOf(id))

  async function searchMembers(groupId: string) {
    const query = (queries[groupId] ?? "").trim()
    if (query.length < 2) {
      setMatches((current) => ({ ...current, [groupId]: [] }))
      setSearched((current) => ({ ...current, [groupId]: false }))
      return
    }
    try {
      const page = await listTenantCustomers({ q: query, page: 1, pageSize: 5 })
      setMatches((current) => ({ ...current, [groupId]: page.items }))
    } catch {
      setMatches((current) => ({ ...current, [groupId]: [] }))
    } finally {
      setSearched((current) => ({ ...current, [groupId]: true }))
    }
  }

  async function addPickedMember(groupId: string, customer: TenantCustomer) {
    if (addingId) {
      return
    }
    setAddingId(customer.id)
    onSavingChange?.(true)
    try {
      await addCustomerGroupMembers(groupId, [customer.id])
      toast.success(t("catalog.productWizard.memberAdded", { name: customer.name }))
      setQueries((current) => ({ ...current, [groupId]: "" }))
      setMatches((current) => ({ ...current, [groupId]: [] }))
      setSearched((current) => ({ ...current, [groupId]: false }))
      await onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("catalog.customerGroups.errors.addMembers"))
    } finally {
      setAddingId(null)
      onSavingChange?.(false)
    }
  }

  return (
    <div className={shellDrivesSave ? "w-full space-y-4" : "mx-auto w-full max-w-xl space-y-4"}>
      {shellDrivesSave ? null : (
        <div>
          <h2 className="text-lg font-semibold">{t("catalog.productWizard.steps.access")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("catalog.productWizard.accessHint")}</p>
        </div>
      )}
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("catalog.products.access.title")}>
        <Button
          type="button"
          variant={visibility === "Public" ? "default" : "outline"}
          className="min-h-11 justify-start"
          aria-pressed={visibility === "Public"}
          disabled={readOnly || saving}
          onClick={() => setVisibility("Public")}
        >
          {t("catalog.products.visibilityFilter.public")}
        </Button>
        <Button
          type="button"
          variant={visibility === "Restricted" ? "default" : "outline"}
          className="min-h-11 justify-start"
          aria-pressed={visibility === "Restricted"}
          disabled={readOnly || saving}
          onClick={() => setVisibility("Restricted")}
        >
          {t("catalog.products.visibilityFilter.restricted")}
        </Button>
      </div>
      {visibility === "Public" && grantCount > 0 ? (
        <p className="text-xs text-muted-foreground">{t("catalog.products.access.storedGrantsHint", { count: grantCount })}</p>
      ) : null}
      {visibility === "Restricted" && grantCount === 0 ? (
        <p role="alert" className="rounded-lg bg-warning/10 p-2 text-sm text-warning-foreground">{t("catalog.products.access.emptyWarning")}</p>
      ) : null}
      {visibility === "Restricted" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("catalog.productWizard.groupsLabel")}</legend>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("catalog.productWizard.noGroups")}</p>
          ) : groups.map((group) => {
            const checked = groupIds.includes(group.id)
            return (
              <label key={group.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={checked}
                  disabled={readOnly || saving}
                  onChange={() => {
                    setGroupIds((current) => checked
                      ? current.filter((id) => id !== group.id)
                      : [...current, group.id])
                  }}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{group.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("catalog.customerGroups.memberCount", { count: group.memberCustomerIds.length })}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>
      ) : null}
      {visibility === "Restricted" ? (
        <div className="space-y-2" data-testid="access-customers">
          <p className="text-sm font-medium">{t("catalog.products.access.customers")}</p>
          {customerIds.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {customerIds.map((id) => (
                <li key={id}>
                  <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={locked} onClick={() => removeCustomer(id)}>
                    {nameOf(id) ?? t("catalog.customerGroups.members.unknown")}
                    <X size={14} aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {missingNames ? <p className="text-xs text-muted-foreground">{t("catalog.products.access.namesUnavailable")}</p> : null}
          {!locked && canSearchCustomers ? <CustomerGrantPicker excludeIds={customerIds} onAdd={addCustomer} /> : null}
          {!locked && !canSearchCustomers ? <p className="text-xs text-muted-foreground">{t("catalog.products.access.needCustomersPermission")}</p> : null}
        </div>
      ) : null}
      {emptyGroups.map((group) => {
        const query = queries[group.id] ?? ""
        const results = matches[group.id] ?? []
        return (
          <div key={group.id} className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm">{t("catalog.productWizard.emptyGroup", { name: group.name })}</p>
            {canSearchCustomers && !readOnly ? (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void searchMembers(group.id)
                }}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={query}
                    onChange={(event) => {
                      const next = event.target.value
                      setQueries((current) => ({ ...current, [group.id]: next }))
                      setMatches((current) => ({ ...current, [group.id]: [] }))
                      setSearched((current) => ({ ...current, [group.id]: false }))
                    }}
                    placeholder={t("catalog.productWizard.memberSearch")}
                    aria-label={t("catalog.productWizard.memberSearch")}
                  />
                  <Button type="submit" className="min-h-11" disabled={query.trim().length < 2}>
                    {t("catalog.productWizard.searchMembers")}
                  </Button>
                </div>
                {results.length > 0 ? (
                  <ul className="space-y-2">
                    {results.map((customer) => (
                      <li key={customer.id}>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 w-full justify-start whitespace-normal text-left"
                          disabled={addingId !== null}
                          onClick={() => void addPickedMember(group.id, customer)}
                        >
                          {t("catalog.productWizard.pickMember", { name: customer.name })}
                          {customer.email ? <span className="text-muted-foreground"> · {customer.email}</span> : null}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {searched[group.id] && results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("catalog.productWizard.noCustomerMatch")}</p>
                ) : null}
              </form>
            ) : null}
            <Link
              className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
              to={productGroupDeepLink(group.id, wizardPath)}
              onClick={(event) => {
                if (!beforeNavigate || !isSameTabPrimaryClick(event)) {
                  return
                }
                if (!beforeNavigate()) {
                  event.preventDefault()
                }
              }}
            >
              {t("catalog.productWizard.actions.openGroup")}
            </Link>
          </div>
        )
      })}
      {saveError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}
      {readOnly || shellDrivesSave ? null : (
        <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={saving} aria-busy={saving} onClick={() => void save()}>
          {saving ? t("common.saveStatus.saving") : t("common.save")}
        </Button>
      )}
    </div>
  )
}
