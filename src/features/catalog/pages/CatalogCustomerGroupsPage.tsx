import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Loader2, Plus, Search, Trash2, Users, X } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { CatalogHeading, CatalogSearch } from "@/features/catalog/components/StaffCatalogChrome"
import {
  catalogAuditActionI18nKey,
  customerGroupFormSchema,
  type CatalogAuditEntry,
  type CustomerGroup,
  type CustomerGroupFormValues,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  addCustomerGroupMembers,
  CatalogDuplicateGroupNameError,
  createCustomerGroup,
  deleteCustomerGroup,
  getCatalogProductAccess,
  getCustomerGroupHistory,
  listCatalogProducts,
  listCustomerGroups,
  removeCustomerGroupMember,
  updateCustomerGroup,
} from "@/features/catalog/services/catalogService"
import { listTenantCustomers } from "@/features/users/services/usersService"
import type { TenantCustomer } from "@/features/users/schemas/userSchemas"
import "@/features/catalog/components/staffCatalog.css"

/** Cap on how many staff products we probe for group usage (API note). */
const WHERE_USED_PRODUCT_CAP = 50

function emptyGroupForm(): CustomerGroupFormValues {
  return { name: "", description: "" }
}

/** Products (by name) that grant access to each group id — best-effort, never blocks the list. */
async function loadWhereUsed(): Promise<Record<string, string[]>> {
  const products = await listCatalogProducts()
  const candidates = products
    .filter((product) => (product.grantedGroupCount ?? 0) > 0)
    .slice(0, WHERE_USED_PRODUCT_CAP)
  const map: Record<string, string[]> = {}
  await Promise.all(
    candidates.map(async (product) => {
      try {
        const access = await getCatalogProductAccess(product.id)
        for (const groupId of access.groupIds) {
          ;(map[groupId] ??= []).push(product.name)
        }
      } catch {
        // A single product's access failing must not break the whole list.
      }
    }),
  )
  return map
}

export function CatalogCustomerGroupsPage() {
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()
  const canManage = can("catalog.products.manage")
  // The customer directory (preload + member search) requires core.customers.read.
  const canReadCustomers = can("core.customers.read")

  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [whereUsed, setWhereUsed] = useState<Record<string, string[]>>({})
  const [customersById, setCustomersById] = useState<Record<string, TenantCustomer>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerGroup | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("details")
  const [history, setHistory] = useState<CatalogAuditEntry[] | "error" | null>(null)
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CustomerGroup | null>(null)
  const [pendingRemove, setPendingRemove] = useState<TenantCustomer | { id: string; name: string } | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)

  const form = useForm<CustomerGroupFormValues>({
    resolver: zodResolver(customerGroupFormSchema),
    defaultValues: emptyGroupForm(),
  })
  const watched = useWatch({ control: form.control })
  const parsed = customerGroupFormSchema.safeParse(watched)
  const isFormValid = parsed.success
  function fieldMessage(name: "name" | "description"): string | undefined {
    if (parsed.success) {
      return undefined
    }
    const issue = parsed.error.issues.find((item) => item.path[0] === name)
    if (!issue) {
      return undefined
    }
    if (name === "name") {
      const { touchedFields, dirtyFields, isSubmitted, errors } = form.formState
      if (errors.name || !(touchedFields.name || dirtyFields.name || isSubmitted)) {
        return undefined
      }
      return issue.code === "too_big"
        ? t("catalog.customerGroups.validation.nameTooLong")
        : t("catalog.customerGroups.validation.nameRequired")
    }
    return t("catalog.customerGroups.validation.descriptionTooLong")
  }

  const rememberCustomers = useCallback((list: readonly TenantCustomer[]) => {
    if (list.length === 0) {
      return
    }
    setCustomersById((current) => {
      const next = { ...current }
      for (const customer of list) {
        next[customer.id] = customer
      }
      return next
    })
  }, [])

  const reload = useCallback(async () => {
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller
    setLoading(true)
    try {
      const nextGroups = await listCustomerGroups({ signal: controller.signal })
      if (controller.signal.aborted) {
        return
      }
      setGroups(nextGroups)
      setLoadError(null)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      setLoadError(
        error instanceof Error ? error.message : t("catalog.customerGroups.errors.load"),
      )
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [t])

  useEffect(() => {
    queueMicrotask(() => void reload())
    return () => loadAbortRef.current?.abort()
  }, [reload])

  // Best-effort "where used" and a customer-name cache for member display.
  useEffect(() => {
    void loadWhereUsed()
      .then(setWhereUsed)
      .catch(() => setWhereUsed({}))
    if (!canReadCustomers) {
      return
    }
    void listTenantCustomers({ pageSize: 50 })
      .then((page) => rememberCustomers(page.items))
      .catch(() => undefined)
  }, [rememberCustomers, canReadCustomers])

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(i18n.language)
    if (term.length === 0) {
      return groups
    }
    return groups.filter((group) =>
      group.name.toLocaleLowerCase(i18n.language).includes(term),
    )
  }, [groups, search, i18n.language])

  function resetDialog() {
    setEditing(null)
    setHistory(null)
    setTab("details")
    form.reset(emptyGroupForm())
  }

  function openCreate() {
    resetDialog()
    setDialogOpen(true)
  }

  function openEdit(group: CustomerGroup) {
    setEditing(group)
    setHistory(null)
    setTab("details")
    form.reset({ name: group.name, description: group.description ?? "" })
    setDialogOpen(true)
    void getCustomerGroupHistory(group.id)
      .then(setHistory)
      .catch(() => setHistory("error"))
  }

  async function onSubmit(values: CustomerGroupFormValues) {
    const body = {
      name: values.name.trim(),
      description: values.description.trim().length === 0 ? null : values.description.trim(),
    }
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateCustomerGroup(editing.id, body)
        setEditing(updated)
        toast.success(t("catalog.customerGroups.toastUpdated"))
      } else {
        const created = await createCustomerGroup(body)
        setEditing(created)
        setTab("members")
        toast.success(t("catalog.customerGroups.toastCreated"))
      }
      await reload()
    } catch (error) {
      if (error instanceof CatalogDuplicateGroupNameError) {
        form.setError("name", { message: error.message })
        return
      }
      toast.error(
        error instanceof Error ? error.message : t("catalog.customerGroups.errors.save"),
      )
    } finally {
      setSaving(false)
    }
  }

  async function onAddMembers(customers: TenantCustomer[]) {
    if (!editing || customers.length === 0) {
      return
    }
    rememberCustomers(customers)
    try {
      const updated = await addCustomerGroupMembers(
        editing.id,
        customers.map((customer) => customer.id),
      )
      setEditing(updated)
      toast.success(t("catalog.customerGroups.members.toastAdded"))
      await reload()
      void getCustomerGroupHistory(updated.id).then(setHistory).catch(() => undefined)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("catalog.customerGroups.errors.addMembers"),
      )
    }
  }

  async function onRemoveMember(customerId: string) {
    if (!editing) {
      return
    }
    setMemberBusyId(customerId)
    try {
      const updated = await removeCustomerGroupMember(editing.id, customerId)
      setEditing(updated)
      toast.success(t("catalog.customerGroups.members.toastRemoved"))
      await reload()
      void getCustomerGroupHistory(updated.id).then(setHistory).catch(() => undefined)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("catalog.customerGroups.errors.removeMember"),
      )
    } finally {
      setMemberBusyId(null)
    }
  }

  async function onDelete(group: CustomerGroup) {
    setSaving(true)
    try {
      await deleteCustomerGroup(group.id)
      toast.success(t("catalog.customerGroups.toastDeleted"))
      if (editing?.id === group.id) {
        setDialogOpen(false)
        resetDialog()
      }
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("catalog.customerGroups.errors.delete"),
      )
    } finally {
      setSaving(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="staff-catalog">
      <CatalogHeading
        title={t("catalog.customerGroups.title")}
        description={t("catalog.customerGroups.subtitle")}
        actions={
          <Can permission="catalog.products.manage">
            <Button type="button" onClick={openCreate}>
              <Plus data-icon="inline-start" />
              {t("catalog.customerGroups.create")}
            </Button>
          </Can>
        }
      />
      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          {t("catalog.customerGroups.readOnlyHint")}
        </p>
      ) : null}
      {loadError ? (
        <Alert variant="destructive" className="staff-catalog-error">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="staff-catalog-card" aria-busy={loading}>
        <div className="staff-catalog-toolbar">
          <CatalogSearch
            value={search}
            onChange={setSearch}
            label={t("catalog.customerGroups.search")}
            placeholder={t("catalog.customerGroups.searchShort")}
          />
        </div>
        {loading ? (
          <span role="status" className="sr-only">
            {t("catalog.staff.loading")}
          </span>
        ) : null}
        {!loading && !loadError && filteredGroups.length === 0 ? (
          <div className="staff-catalog-empty" role="status">
            <EmptyState
              icon={Users}
              className="border-0 p-0"
              title={
                groups.length > 0
                  ? t("catalog.staff.noResults")
                  : t("catalog.customerGroups.empty")
              }
              description={
                groups.length > 0
                  ? t("catalog.staff.adjustFilters")
                  : t("catalog.customerGroups.emptyHint")
              }
              action={
                groups.length > 0 ? undefined : (
                  <Can permission="catalog.products.manage">
                    <Button type="button" onClick={openCreate}>
                      <Plus data-icon="inline-start" />
                      {t("catalog.customerGroups.create")}
                    </Button>
                  </Can>
                )
              }
            />
          </div>
        ) : !loading && !loadError ? (
          <table
            className="staff-catalog-table w-full"
            aria-label={t("catalog.customerGroups.title")}
          >
            <thead>
              <tr>
                <th>{t("catalog.customerGroups.columns.name")}</th>
                <th className="hidden md:table-cell">
                  {t("catalog.customerGroups.columns.description")}
                </th>
                <th>{t("catalog.customerGroups.columns.members")}</th>
                <th>{t("catalog.customerGroups.columns.usage")}</th>
                {canManage ? (
                  <th>{t("catalog.customerGroups.columns.actions")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => {
                const usedBy = whereUsed[group.id] ?? []
                return (
                  <tr key={group.id}>
                    <td>
                      {canManage ? (
                        <button
                          type="button"
                          className="touch-target staff-catalog-name-button"
                          onClick={() => openEdit(group)}
                        >
                          <strong>{group.name}</strong>
                        </button>
                      ) : (
                        <strong>{group.name}</strong>
                      )}
                    </td>
                    <td className="hidden md:table-cell">
                      {group.description ?? "—"}
                    </td>
                    <td>
                      {t("catalog.customerGroups.memberCount", {
                        count: group.memberCustomerIds.length,
                      })}
                    </td>
                    <td>
                      {usedBy.length > 0 ? (
                        <span
                          className="staff-catalog-status"
                          data-tone="success"
                          title={usedBy.join(", ")}
                        >
                          {t("catalog.customerGroups.usage.products", {
                            count: usedBy.length,
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("catalog.customerGroups.usage.none")}
                        </span>
                      )}
                    </td>
                    {canManage ? (
                      <td>
                        <div className="staff-catalog-actions">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`${t("catalog.customerGroups.delete")}: ${group.name}`}
                            onClick={() => setPendingDelete(group)}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                            {t("catalog.customerGroups.delete")}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : null}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && saving) {
            return
          }
          setDialogOpen(open)
          if (!open) {
            resetDialog()
          }
        }}
      >
        <DialogContent className="staff-catalog-editor flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editing
                ? t("catalog.customerGroups.editTitle")
                : t("catalog.customerGroups.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("catalog.customerGroups.subtitle")}
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <Tabs
              value={tab}
              onValueChange={setTab}
              className="min-h-0 min-w-0 flex-1"
            >
              <TabsList>
                <TabsTrigger value="details">
                  {t("catalog.customerGroups.tabs.details")}
                </TabsTrigger>
                <TabsTrigger value="members">
                  {t("catalog.customerGroups.tabs.members")}
                </TabsTrigger>
                <TabsTrigger value="history">
                  {t("catalog.customerGroups.tabs.history")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="overflow-y-auto">
                <GroupForm
                  form={form}
                  fieldMessage={fieldMessage}
                  isFormValid={isFormValid}
                  saving={saving}
                  disabled={!canManage}
                  onSubmit={onSubmit}
                />
              </TabsContent>
              <TabsContent value="members" className="overflow-y-auto">
                <MembersSection
                  group={editing}
                  customersById={customersById}
                  canManage={canManage}
                  canSearchCustomers={canReadCustomers}
                  memberBusyId={memberBusyId}
                  onAddMembers={onAddMembers}
                  onRequestRemove={(member) => setPendingRemove(member)}
                  onResolveCustomers={rememberCustomers}
                />
              </TabsContent>
              <TabsContent value="history" className="overflow-y-auto">
                <HistorySection entries={history} />
              </TabsContent>
            </Tabs>
          ) : (
            <GroupForm
              form={form}
              fieldMessage={fieldMessage}
              isFormValid={isFormValid}
              saving={saving}
              disabled={!canManage}
              onSubmit={onSubmit}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("catalog.customerGroups.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("catalog.customerGroups.deleteBody", {
                name: pendingDelete?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          {pendingDelete ? (
            <div className="text-sm">
              {(whereUsed[pendingDelete.id] ?? []).length > 0 ? (
                <>
                  <p className="font-medium">
                    {t("catalog.customerGroups.deleteAffected")}
                  </p>
                  <ul className="list-disc pl-5">
                    {(whereUsed[pendingDelete.id] ?? []).map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-muted-foreground">
                  {t("catalog.customerGroups.deleteNoAffected")}
                </p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
            >
              {t("common.cancel")}
            </Button>
            <LoadingButton
              type="button"
              variant="destructive"
              loading={saving}
              onClick={() => {
                if (pendingDelete) {
                  void onDelete(pendingDelete)
                }
              }}
            >
              {t("catalog.customerGroups.delete")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemove(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("catalog.customerGroups.members.removeTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("catalog.customerGroups.members.removeBody", {
                name: pendingRemove?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRemove(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const member = pendingRemove
                setPendingRemove(null)
                if (member) {
                  void onRemoveMember(member.id)
                }
              }}
            >
              {t("catalog.customerGroups.members.remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GroupForm({
  form,
  fieldMessage,
  isFormValid,
  saving,
  disabled,
  onSubmit,
}: {
  form: ReturnType<typeof useForm<CustomerGroupFormValues>>
  fieldMessage: (name: "name" | "description") => string | undefined
  isFormValid: boolean
  saving: boolean
  disabled: boolean
  onSubmit: (values: CustomerGroupFormValues) => void | Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <Form {...form}>
      <form
        className="space-y-4 px-1 py-2"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("catalog.customerGroups.form.name")}</FormLabel>
              <FormControl>
                <Input autoComplete="off" maxLength={200} disabled={disabled} {...field} />
              </FormControl>
              <p className="min-h-5 text-sm text-destructive" aria-live="polite">
                {fieldMessage("name") ?? ""}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("catalog.customerGroups.form.description")}
              </FormLabel>
              <FormControl>
                <Textarea rows={3} disabled={disabled} {...field} />
              </FormControl>
              {fieldMessage("description") ? (
                <p className="text-sm text-destructive">
                  {fieldMessage("description")}
                </p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />
        {!disabled ? (
          <div className="flex justify-end">
            <FormPrimaryButton
              type="submit"
              isValid={isFormValid}
              loading={saving}
              loadingLabel={t("catalog.customerGroups.saving")}
            >
              {t("catalog.customerGroups.save")}
            </FormPrimaryButton>
          </div>
        ) : null}
      </form>
    </Form>
  )
}

function MembersSection({
  group,
  customersById,
  canManage,
  canSearchCustomers,
  memberBusyId,
  onAddMembers,
  onRequestRemove,
  onResolveCustomers,
}: {
  group: CustomerGroup
  customersById: Record<string, TenantCustomer>
  canManage: boolean
  canSearchCustomers: boolean
  memberBusyId: string | null
  onAddMembers: (customers: TenantCustomer[]) => void | Promise<void>
  onRequestRemove: (member: { id: string; name: string }) => void
  onResolveCustomers: (list: readonly TenantCustomer[]) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4 px-1 py-2">
      <p className="text-sm font-medium">
        {t("catalog.customerGroups.members.title", {
          count: group.memberCustomerIds.length,
        })}
      </p>
      {canManage && canSearchCustomers ? (
        <AddMemberPicker
          excludeIds={group.memberCustomerIds}
          onAdd={onAddMembers}
          onResolveCustomers={onResolveCustomers}
        />
      ) : null}
      {canManage && !canSearchCustomers ? (
        <p className="text-xs text-muted-foreground">{t("catalog.products.access.needCustomersPermission")}</p>
      ) : null}
      {group.memberCustomerIds.some((id) => !customersById[id] && !group.memberNames?.[id]) ? (
        <p className="text-xs text-muted-foreground">{t("catalog.products.access.namesUnavailable")}</p>
      ) : null}
      {group.memberCustomerIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("catalog.customerGroups.members.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {group.memberCustomerIds.map((id) => {
            const customer = customersById[id]
            const name = customer?.name ?? group.memberNames?.[id] ?? t("catalog.customerGroups.members.unknown")
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{name}</span>
                  {canManage && customer?.email ? (
                    <span className="block truncate text-muted-foreground">
                      {customer.email}
                    </span>
                  ) : null}
                </span>
                {canManage ? (
                  <LoadingButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={memberBusyId === id}
                    onClick={() => onRequestRemove({ id, name })}
                  >
                    {t("catalog.customerGroups.members.remove")}
                  </LoadingButton>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {t("catalog.customerGroups.members.hint")}
      </p>
    </div>
  )
}

function AddMemberPicker({
  excludeIds,
  onAdd,
  onResolveCustomers,
}: {
  excludeIds: string[]
  onAdd: (customers: TenantCustomer[]) => void | Promise<void>
  onResolveCustomers: (list: readonly TenantCustomer[]) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TenantCustomer[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<TenantCustomer[]>([])

  useEffect(() => {
    const term = query.trim()
    if (term.length === 0) {
      return
    }
    let active = true
    const timer = setTimeout(() => {
      setSearching(true)
      void listTenantCustomers({ q: term, pageSize: 20 })
        .then((page) => {
          if (!active) {
            return
          }
          onResolveCustomers(page.items)
          setResults(page.items)
        })
        .catch(() => {
          if (active) {
            setResults([])
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false)
          }
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, onResolveCustomers])

  const selectedIds = new Set(selected.map((customer) => customer.id))
  const excluded = new Set(excludeIds)
  const visible = (query.trim().length === 0 ? [] : results).filter(
    (customer) => !excluded.has(customer.id) && !selectedIds.has(customer.id),
  )

  function toggle(customer: TenantCustomer) {
    setSelected((current) =>
      current.some((item) => item.id === customer.id)
        ? current.filter((item) => item.id !== customer.id)
        : [...current, customer],
    )
  }

  async function confirmAdd() {
    if (selected.length === 0) {
      return
    }
    await onAdd(selected)
    setSelected([])
    setQuery("")
    setResults([])
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="staff-catalog-search">
        <Search size={20} aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("catalog.customerGroups.members.searchLabel")}
          placeholder={t("catalog.customerGroups.members.searchPlaceholder")}
          className="min-w-0"
        />
      </label>
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((customer) => (
            <li key={customer.id}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggle(customer)}
              >
                {customer.name}
                <X size={14} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {searching ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("catalog.staff.loading")}
        </p>
      ) : query.trim().length > 0 && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("catalog.customerGroups.members.noResults")}
        </p>
      ) : (
        <ul className="max-h-48 divide-y divide-border overflow-y-auto">
          {visible.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="touch-target flex w-full items-center justify-between gap-2 py-2 text-left text-sm"
                onClick={() => toggle(customer)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {customer.name}
                  </span>
                  {customer.email ? (
                    <span className="block truncate text-muted-foreground">
                      {customer.email}
                    </span>
                  ) : null}
                </span>
                <Plus size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t("catalog.customerGroups.members.selectHint")}
        </span>
        <Button
          type="button"
          size="sm"
          disabled={selected.length === 0}
          onClick={() => {
            void confirmAdd()
          }}
        >
          {t("catalog.customerGroups.members.addSelected")}
        </Button>
      </div>
    </div>
  )
}

function HistorySection({
  entries,
}: {
  entries: CatalogAuditEntry[] | "error" | null
}) {
  const { t, i18n } = useTranslation()
  if (entries === "error") {
    return (
      <p role="alert" className="px-1 py-2 text-sm text-destructive">
        {t("catalog.products.access.history.loadError")}
      </p>
    )
  }
  if (entries === null) {
    return (
      <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t("catalog.staff.loading")}
      </p>
    )
  }
  if (entries.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-muted-foreground">
        {t("catalog.customerGroups.history.empty")}
      </p>
    )
  }
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  return (
    <ul className="space-y-3 px-1 py-2 text-sm">
      {entries.map((entry) => {
        const actor = entry.actorName
          ? `${t("catalog.customerGroups.history.actorTeam")} · ${entry.actorName}`
          : t("catalog.customerGroups.history.actorTeam")
        return (
          <li key={entry.id} className="border-b border-border pb-2 last:border-0">
            <span className="font-medium">{actor}</span>{" "}
            {t(catalogAuditActionI18nKey(entry.action))}
            <span className="block text-xs text-muted-foreground">
              {dateFormat.format(new Date(entry.createdAt))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
