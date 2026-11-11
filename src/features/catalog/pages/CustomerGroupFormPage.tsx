import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  addCustomerGroupMembers,
  CatalogDuplicateGroupNameError,
  createCustomerGroup,
  getCustomerGroup,
  updateCustomerGroup,
} from "@/features/catalog/services/catalogService"
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

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void getCustomerGroup(id).then((group) => {
      if (cancelled) return
      const next = { name: group.name, description: group.description ?? "" }
      setName(next.name)
      setDescription(next.description)
      setBaseline(next)
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

  const dirty = !saved && (name !== baseline.name || description !== baseline.description || selected.length > 0)
  useEffect(() => {
    if (!dirty) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", preventUnload)
    return () => window.removeEventListener("beforeunload", preventUnload)
  }, [dirty])

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
      void navigate("/grupos")
    } catch (error: unknown) {
      if (error instanceof CatalogDuplicateGroupNameError) setNameError(error.message)
      else toast.error(error instanceof Error ? error.message : t("catalog.customerGroups.errors.save"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grupos-page mx-auto min-w-0 space-y-5">
      <nav aria-label={t("nav.breadcrumbLabel")} className="text-sm text-muted-foreground">
        <ol className="flex min-w-0 flex-wrap items-center gap-2">
          <li><Link to="/grupos" className="inline-flex min-h-11 items-center rounded-md">{t("grupos.title")}</Link></li>
          <li aria-hidden="true">/</li>
          <li><span aria-current="page" className="text-foreground">{title}</span></li>
        </ol>
      </nav>
      <header>
        <p className="grupos-eyebrow">{t("grupos.eyebrow")}</p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t(editing ? "grupos.editSubtitle" : "grupos.createSubtitle")}</p>
      </header>
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
      {!loading && missing ? <p role="alert" className="text-sm text-destructive">{nameError ?? t("catalog.customerGroups.page.notFound")}</p> : null}
      {!loading && !missing ? (
        <form className="grupos-card" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          {!canManage ? <p className="px-[18px] pt-5 text-sm text-muted-foreground">{t("catalog.customerGroups.readOnlyHint")}</p> : null}
          <div className="grupos-form">
            <div className="grupos-field">
              <label htmlFor="group-name" className="mb-1.5 block text-sm font-medium">{t("grupos.name")}</label>
              <Input
                id="group-name"
                value={name}
                disabled={!canManage || saving}
                placeholder={t("grupos.namePlaceholder")}
                aria-invalid={nameFieldError ? true : undefined}
                aria-describedby={nameFieldError ? "group-name-help group-name-error" : "group-name-help"}
                onBlur={() => setTouchedName(true)}
                onChange={(event) => { setName(event.target.value); setNameError(null) }}
              />
              <p id="group-name-help" className="mt-1.5 text-xs text-muted-foreground">{t("grupos.nameHelp")}</p>
              {nameFieldError ? <p id="group-name-error" className="mt-1 text-xs text-destructive" role="alert">{nameFieldError}</p> : null}
            </div>
            <div className="grupos-field">
              <label htmlFor="group-description" className="mb-1.5 block text-sm font-medium">
                {t("grupos.description")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
              </label>
              <Textarea
                id="group-description"
                value={description}
                disabled={!canManage || saving}
                placeholder={t("grupos.descriptionPlaceholder")}
                aria-invalid={descriptionError ? true : undefined}
                aria-describedby={descriptionError ? "group-description-error" : undefined}
                onChange={(event) => setDescription(event.target.value)}
              />
              {descriptionError ? <p id="group-description-error" className="mt-1 text-xs text-destructive" role="alert">{descriptionError}</p> : null}
            </div>
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
                      <label key={customer.id} className="flex min-h-11 items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected.includes(customer.id)}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setSelected((current) => checked ? [...current, customer.id] : current.filter((item) => item !== customer.id))
                          }}
                        />
                        <span>{customer.name}</span>
                        {customer.email ? <small className="text-muted-foreground">{customer.email}</small> : null}
                      </label>
                    ))}
                    <p className="text-xs text-muted-foreground">{t("grupos.membersHint")}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="grupos-form-actions">
            <FormPrimaryButton type="submit" isValid={valid} loading={saving}>{t("grupos.save")}</FormPrimaryButton>
            <Button type="button" variant="ghost" className="min-h-11" disabled={saving} onClick={() => { void navigate("/grupos") }}>{t("common.cancel")}</Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
