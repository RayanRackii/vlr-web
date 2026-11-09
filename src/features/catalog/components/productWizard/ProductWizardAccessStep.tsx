import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { productGroupDeepLink } from "@/features/catalog/components/productWizard/wizardSteps"
import type { CatalogProductVisibility, CustomerGroup } from "@/features/catalog/schemas/catalogSchemas"
import {
  addCustomerGroupMembers,
  putCatalogProductAccess,
} from "@/features/catalog/services/catalogService"
import { listTenantCustomers } from "@/features/users/services/usersService"

type ProductWizardAccessStepProps = {
  productId: string
  visibility: CatalogProductVisibility
  customerIds: readonly string[]
  groupIds: readonly string[]
  groups: readonly CustomerGroup[]
  wizardPath: string
  readOnly: boolean
  canSearchCustomers: boolean
  onSaved: () => void
}

export function ProductWizardAccessStep({
  productId,
  visibility: initialVisibility,
  customerIds,
  groupIds: initialGroupIds,
  groups,
  wizardPath,
  readOnly,
  canSearchCustomers,
  onSaved,
}: ProductWizardAccessStepProps) {
  const { t } = useTranslation()
  const [visibility, setVisibility] = useState<CatalogProductVisibility>(initialVisibility)
  const [groupIds, setGroupIds] = useState<string[]>([...initialGroupIds])
  const [memberQuery, setMemberQuery] = useState("")
  const [memberNames, setMemberNames] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)

  const emptyGroups = useMemo(
    () => groups.filter((group) => groupIds.includes(group.id) && group.memberCustomerIds.length === 0),
    [groupIds, groups],
  )

  async function save() {
    if (readOnly || saving) {
      return
    }
    setSaving(true)
    try {
      await putCatalogProductAccess(productId, {
        visibility,
        customerIds: [...customerIds],
        groupIds,
      })
      toast.success(t("catalog.productWizard.accessSaved"))
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("catalog.customerGroups.errors.saveAccess"))
    } finally {
      setSaving(false)
    }
  }

  async function addFirstMatch(groupId: string) {
    const query = memberQuery.trim()
    if (query.length < 2 || adding) {
      return
    }
    setAdding(true)
    try {
      const page = await listTenantCustomers({ q: query, page: 1, pageSize: 5 })
      const customer = page.items[0]
      if (!customer) {
        setMemberNames([])
        toast.error(t("catalog.productWizard.noCustomerMatch"))
        return
      }
      await addCustomerGroupMembers(groupId, [customer.id])
      toast.success(t("catalog.productWizard.memberAdded", { name: customer.name }))
      setMemberQuery("")
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("catalog.customerGroups.errors.addMembers"))
    } finally {
      setAdding(false)
    }
  }

  async function searchMembers() {
    const query = memberQuery.trim()
    if (query.length < 2) {
      setMemberNames([])
      return
    }
    try {
      const page = await listTenantCustomers({ q: query, page: 1, pageSize: 5 })
      setMemberNames(page.items.map((customer) => customer.name))
    } catch {
      setMemberNames([])
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("catalog.productWizard.steps.access")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("catalog.productWizard.accessHint")}</p>
      </div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("catalog.products.access.title")}>
        <Button
          type="button"
          variant={visibility === "Public" ? "default" : "outline"}
          className="min-h-11 justify-start"
          aria-pressed={visibility === "Public"}
          disabled={readOnly}
          onClick={() => setVisibility("Public")}
        >
          {t("catalog.products.visibilityFilter.public")}
        </Button>
        <Button
          type="button"
          variant={visibility === "Restricted" ? "default" : "outline"}
          className="min-h-11 justify-start"
          aria-pressed={visibility === "Restricted"}
          disabled={readOnly}
          onClick={() => setVisibility("Restricted")}
        >
          {t("catalog.products.visibilityFilter.restricted")}
        </Button>
      </div>
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
                  disabled={readOnly}
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
      {emptyGroups.map((group) => (
        <div key={group.id} className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm">{t("catalog.productWizard.emptyGroup", { name: group.name })}</p>
          {canSearchCustomers && !readOnly ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                onBlur={() => void searchMembers()}
                placeholder={t("catalog.productWizard.memberSearch")}
                aria-label={t("catalog.productWizard.memberSearch")}
              />
              <Button type="button" className="min-h-11" disabled={adding || memberQuery.trim().length < 2} onClick={() => void addFirstMatch(group.id)}>
                {t("catalog.productWizard.addMember")}
              </Button>
            </div>
          ) : null}
          {memberNames.length > 0 ? (
            <p className="text-xs text-muted-foreground">{memberNames.join(", ")}</p>
          ) : null}
          <Link className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline" to={productGroupDeepLink(group.id, wizardPath)}>
            {t("catalog.productWizard.actions.openGroup")}
          </Link>
        </div>
      ))}
      {readOnly ? null : (
        <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={saving} onClick={() => void save()}>
          {t("common.save")}
        </Button>
      )}
    </div>
  )
}
