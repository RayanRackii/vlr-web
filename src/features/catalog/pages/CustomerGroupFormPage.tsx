import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FormPage } from "@/components/layout/FormPage"
import { Page } from "@/components/layout/Page"
import { FormGrid, FormRow, FormSection } from "@/components/ui/form-layout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  addCustomerGroupMembers,
  CatalogDuplicateGroupNameError,
  createCustomerGroup,
  getCustomerGroup,
  removeCustomerGroupMember,
  updateCustomerGroup,
} from "@/features/catalog/services/catalogService"
import { StaffReturnLink } from "@/features/rentals/components/resourceWizard/StaffReturnLink"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type { TenantCustomer } from "@/features/users/schemas/userSchemas"
import { listTenantCustomers } from "@/features/users/services/usersService"
import "@/features/catalog/pages/grupos.css"

export function CustomerGroupFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()
  const canManage = can("catalog.products.manage")
  const canReadCustomers = can("core.customers.read")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [baseline, setBaseline] = useState({ name: "", description: "" })
  const [loading, setLoading] = useState(editing)
  const [missing, setMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [touchedName, setTouchedName] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [customers, setCustomers] = useState<TenantCustomer[] | null>(null)
  const [memberQuery, setMemberQuery] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [memberResults, setMemberResults] = useState<TenantCustomer[]>([])
  const [memberSearching, setMemberSearching] = useState(false)
  const [memberBusy, setMemberBusy] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void getCustomerGroup(id).then((group) => {
      if (cancelled) return
      const next = { name: group.name, description: group.description ?? "" }
      setName(next.name)
      setDescription(next.description)
      setBaseline(next)
      setMemberIds(group.memberCustomerIds)
      setMemberNames(group.memberNames ?? {})
      setMissing(false)
    }).catch((error: unknown) => {
      if (cancelled) return
      setMissing(true)
      setNameError(error instanceof Error ? error.message : t("catalog.customerGroups.errors.load"))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [id, t])

  useEffect(() => {
    if (!membersOpen || !canReadCustomers || customers) return
    let cancelled = false
    void listTenantCustomers({ pageSize: 50 }).then((page) => {
      if (!cancelled) setCustomers(page.items)
    }).catch(() => {
      if (!cancelled) setCustomers([])
    })
    return () => { cancelled = true }
  }, [canReadCustomers, customers, membersOpen])

  useEffect(() => {
    if (!editing || !membersOpen || !canReadCustomers) return
    const term = memberQuery.trim()
    if (!term) return
    let cancelled = false
    const timer = setTimeout(() => {
      setMemberSearching(true)
      void listTenantCustomers({ q: term, pageSize: 20 }).then((page) => {
        if (!cancelled) setMemberResults(page.items)
      }).catch(() => {
        if (!cancelled) setMemberResults([])
      }).finally(() => {
        if (!cancelled) setMemberSearching(false)
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [canReadCustomers, editing, memberQuery, membersOpen])

  function rememberMembers(group: { memberCustomerIds: string[]; memberNames?: Record<string, string> | null }, extra?: TenantCustomer) {
    setMemberIds(group.memberCustomerIds)
    setMemberNames({
      ...memberNames,
      ...(group.memberNames ?? {}),
      ...(extra ? { [extra.id]: extra.name } : {}),
    })
  }

  async function addMember(customer: TenantCustomer) {
    if (!id || memberBusy || memberIds.includes(customer.id)) return
    setMemberBusy(true)
    try {
      const updated = await addCustomerGroupMembers(id, [customer.id])
      rememberMembers(updated, customer)
      setMemberQuery("")
      setMemberResults([])
      toast.success(t("catalog.customerGroups.members.toastAdded"))
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("catalog.customerGroups.errors.addMembers"))
    } finally {
      setMemberBusy(false)
    }
  }

  async function removeMember(customerId: string) {
    if (!id || memberBusy) return
    setMemberBusy(true)
    try {
      const updated = await removeCustomerGroupMember(id, customerId)
      rememberMembers(updated)
      setRemoveId(null)
      toast.success(t("catalog.customerGroups.members.toastRemoved"))
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("catalog.customerGroups.errors.removeMember"))
    } finally {
      setMemberBusy(false)
    }
  }

  const dirty = !saved && (name !== baseline.name || description !== baseline.description || selected.length > 0)
  // Leave from an effect so the unsaved-changes guard is already released.
  useEffect(() => {
    if (saved) void navigate("/grupos")
  }, [navigate, saved])

  const nameTrim = name.trim()
  const descriptionTrim = description.trim()
  const tooLongName = nameTrim.length > 200
  const tooLongDescription = descriptionTrim.length > 2000
  const showRequired = (touchedName || submitted) && nameTrim.length === 0
  const nameFieldError = nameError
    ?? (showRequired ? t("grupos.nameRequired") : null)
    ?? (tooLongName ? t("catalog.customerGroups.validation.nameTooLong") : null)
  const descriptionError = tooLongDescription ? t("catalog.customerGroups.validation.descriptionTooLong") : null
  const valid = canManage && nameTrim.length > 0 && !tooLongName && !tooLongDescription && !nameError
  const title = t(editing ? "grupos.editTitle" : "grupos.createTitle")
  const memberTerm = memberQuery.trim().toLocaleLowerCase(i18n.language)
  const visibleCustomers = (customers ?? []).filter((customer) => !memberTerm || `${customer.name} ${customer.email ?? ""}`.toLocaleLowerCase(i18n.language).includes(memberTerm))

  async function submit() {
    setSubmitted(true)
    if (!valid || saving) return
    setSaving(true)
    setNameError(null)
    const body = { name: nameTrim, description: descriptionTrim.length > 0 ? descriptionTrim : null }
    try {
      if (editing && id) {
        await updateCustomerGroup(id, body)
        toast.success(t("catalog.customerGroups.toastUpdated"))
      } else {
        let groupId = createdId
        if (!groupId) {
          groupId = (await createCustomerGroup(body)).id
          setCreatedId(groupId)
        }
        if (selected.length > 0) await addCustomerGroupMembers(groupId, selected)
        toast.success(t("catalog.customerGroups.toastCreated"))
      }
      setSaved(true)
    } catch (error: unknown) {
      if (error instanceof CatalogDuplicateGroupNameError) setNameError(error.message)
      else toast.error(error instanceof Error ? error.message : t("catalog.customerGroups.errors.save"))
    } finally {
      setSaving(false)
    }
  }

  const header = {
    eyebrow: t("grupos.eyebrow"),
    title,
    description: t(editing ? "grupos.editSubtitle" : "grupos.createSubtitle"),
    actions: <StaffReturnLink />,
  }

  if (loading || missing) {
    return (
      <Page width="form" header={header}>
        {loading ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
        {!loading && missing ? <p role="alert" className="text-sm text-destructive">{nameError ?? t("catalog.customerGroups.page.notFound")}</p> : null}
      </Page>
    )
  }

  return (
    <FormPage
      header={header}
      submitFormId="customer-group-form"
      dirty={dirty}
      saving={saving}
      saveDisabled={!valid}
      saveLabel={t("grupos.save")}
      discardLabel={t("common.cancel")}
      guardUnsaved={!saved}
      onDiscard={() => { void navigate("/grupos") }}
    >
      <form id="customer-group-form" className="space-y-5" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <FormSection title={t("grupos.sectionDetails")}>
          {!canManage ? <p className="text-sm text-muted-foreground">{t("catalog.customerGroups.readOnlyHint")}</p> : null}
          <FormGrid>
            <FormRow
              label={t("grupos.name")}
              htmlFor="group-name"
              hint={t("grupos.nameHelp")}
              required
              error={nameFieldError}
            >
              <Input
                id="group-name"
                value={name}
                disabled={!canManage || saving}
                placeholder={t("grupos.namePlaceholder")}
                onBlur={() => setTouchedName(true)}
                onChange={(event) => { setName(event.target.value); setNameError(null) }}
              />
            </FormRow>
            <FormRow
              label={<>{t("grupos.description")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></>}
              htmlFor="group-description"
              error={descriptionError}
            >
              <Textarea
                id="group-description"
                value={description}
                disabled={!canManage || saving}
                placeholder={t("grupos.descriptionPlaceholder")}
                onChange={(event) => setDescription(event.target.value)}
              />
            </FormRow>
            {!editing && canManage && canReadCustomers ? (
              <div className="grupos-expander">
                <button type="button" aria-expanded={membersOpen} aria-controls="group-members" onClick={() => setMembersOpen((open) => !open)}>
                  <span>{t("grupos.members")}</span>
                  <span aria-hidden="true">{membersOpen ? "−" : "+"}</span>
                </button>
                {membersOpen ? (
                  <div id="group-members" className="space-y-2 px-3.5 pb-3">
                    <Input type="search" aria-label={t("grupos.membersSearch")} placeholder={t("grupos.membersSearch")} value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} />
                    {customers === null ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
                    {customers !== null && visibleCustomers.length === 0 ? <p className="text-sm text-muted-foreground">{t("grupos.membersEmpty")}</p> : null}
                    {visibleCustomers.map((customer) => (
                      <Label key={customer.id} className="min-h-11 text-sm font-normal leading-normal">
                        <Checkbox
                          checked={selected.includes(customer.id)}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setSelected((current) => checked ? [...current, customer.id] : current.filter((item) => item !== customer.id))
                          }}
                        />
                        <span>{customer.name}</span>
                        {customer.email ? <small className="text-muted-foreground">{customer.email}</small> : null}
                      </Label>
                    ))}
                    <p className="text-xs text-muted-foreground">{t("grupos.membersHint")}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {editing && canManage ? (
              <div className="grupos-expander">
                <button type="button" aria-expanded={membersOpen} aria-controls="group-edit-members" onClick={() => setMembersOpen((open) => !open)}>
                  <span>{t("grupos.membersEdit")}</span>
                  <span aria-hidden="true">{membersOpen ? "−" : "+"}</span>
                </button>
                {membersOpen ? (
                  <div id="group-edit-members" className="space-y-2 px-3.5 pb-3">
                    {canReadCustomers ? (
                      <>
                        <Input
                          type="search"
                          aria-label={t("catalog.customerGroups.members.searchLabel")}
                          placeholder={t("catalog.customerGroups.members.searchPlaceholder")}
                          value={memberQuery}
                          onChange={(event) => {
                            setMemberQuery(event.target.value)
                            if (!event.target.value.trim()) setMemberResults([])
                          }}
                        />
                        {memberSearching ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
                        {memberResults.filter((customer) => !memberIds.includes(customer.id)).map((customer) => (
                          <div key={customer.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                            <span className="min-w-0">{customer.name}{customer.email ? <small className="ml-2 text-muted-foreground">{customer.email}</small> : null}</span>
                            <Button type="button" variant="outline" size="sm" disabled={memberBusy} onClick={() => { void addMember(customer) }}>{t("grupos.addMember")}</Button>
                          </div>
                        ))}
                      </>
                    ) : <p className="text-xs text-muted-foreground">{t("catalog.products.access.needCustomersPermission")}</p>}
                    {memberIds.length === 0 ? <p className="text-sm text-muted-foreground">{t("catalog.customerGroups.members.empty")}</p> : (
                      <ul>
                        {memberIds.map((memberId) => {
                          const memberName = memberNames[memberId] ?? t("catalog.customerGroups.members.unknown")
                          return (
                            <li key={memberId} className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-border py-1 text-sm">
                              <span className="min-w-0">{memberName}</span>
                              {removeId === memberId ? (
                                <span className="flex gap-2">
                                  <Button type="button" variant="outline" size="sm" disabled={memberBusy} onClick={() => { void removeMember(memberId) }}>{t("catalog.customerGroups.members.remove")}</Button>
                                  <Button type="button" variant="ghost" size="sm" disabled={memberBusy} onClick={() => setRemoveId(null)}>{t("common.cancel")}</Button>
                                </span>
                              ) : (
                                <Button type="button" variant="ghost" size="sm" disabled={memberBusy} onClick={() => setRemoveId(memberId)}>{t("catalog.customerGroups.members.remove")}</Button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </FormGrid>
        </FormSection>
      </form>
    </FormPage>
  )
}
