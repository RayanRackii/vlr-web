import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Link, UNSAFE_DataRouterContext as DataRouterContext, useBlocker, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ErrorState } from "@/components/ErrorState"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { RentalResourceEditorForm } from "@/features/rentals/components/RentalResourceEditorForm"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { getUnits } from "@/features/assets/services/unitsService"
import { getAssetPricings, type RentalPricing } from "@/features/assets/services/rentalPricingService"
import {
  toCreateRentableRequest,
  type RegistryCategoryListItem,
  type RentalResourceFormValues,
} from "@/features/rentals/schemas/rentalResourceSchemas"
import {
  createRentalAsset,
  listRentalAssetCategories,
  listRentalAssetFamilies,
  updateRentalAsset,
} from "@/features/rentals/services/rentalResourcesService"
import {
  listAdminRentalAssets,
  type AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { mapRbacErrorMessage } from "@/features/users/permissions/rbacErrors"


const RESOURCES_PATH = "/configuracoes/recursos"

function LeaveConfirmation({ open, onStay, onLeave }: {
  open: boolean
  onStay: () => void
  onLeave: () => void
}) {
  const { t } = useTranslation()
  return <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onStay() }}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t("fullPage.leaveConfirm")}</AlertDialogTitle></AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
        <AlertDialogAction onClick={onLeave}>{t("fullPage.discard")}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

function RouterLeaveGuard({ dirty, saving }: { dirty: boolean; saving: boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || saving) && (
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search
  ))
  useEffect(() => {
    if (saving && blocker.state === "blocked") blocker.reset()
  }, [blocker, saving])
  return <LeaveConfirmation open={blocker.state === "blocked" && !saving}
    onStay={() => blocker.state === "blocked" && blocker.reset()}
    onLeave={() => blocker.state === "blocked" && blocker.proceed()} />
}

export function RentalResourceEditorPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const hasDataRouter = useContext(DataRouterContext) != null
  const { can } = usePermissions()
  const { isTrialReadOnly } = useTrialStatus()
  const canWrite = can("rentals.assets.write") && !isTrialReadOnly
  const canReadPricing = can("rentals.pricing.read")
  const [editing, setEditing] = useState<AdminRentalAsset | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<RegistryCategoryListItem[]>([])
  const [families, setFamilies] = useState<AssetFamily[]>([])
  const [price, setPrice] = useState<RentalPricing | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    if (!dirty || saved) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", preventUnload)
    return () => window.removeEventListener("beforeunload", preventUnload)
  }, [dirty, saved])
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveInFlight = useRef(false)
  const lifetime = useRef({ active: true })

  useEffect(() => {
    const currentLifetime = { active: true }
    lifetime.current = currentLifetime
    return () => {
      currentLifetime.active = false
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [id])

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    setLoading(true)
    setLoadError(null)
    try {
      const [assetList, categoryList, familyList, unitList] = await Promise.all([
        id ? listAdminRentalAssets() : Promise.resolve([]),
        listRentalAssetCategories(), listRentalAssetFamilies(), getUnits(),
      ])
      if (!isCurrent()) return
      const resource = id ? assetList.find((asset) => asset.id === id) : null
      if (id && !resource) throw new Error(t("rentals.resources.editor.notFound"))
      setEditing(resource ?? null)
      setCategories(categoryList)
      setFamilies(familyList)
      setUnits(unitList)
      setPrice(null)
      if (resource && canReadPricing) {
        try {
          const pricings = await getAssetPricings(resource.assetId)
          if (!isCurrent()) return
          setPrice(pricings.filter((pricing) => pricing.pricePerHour > 0).reduce<RentalPricing | null>(
            (lowest, pricing) => lowest === null || pricing.pricePerHour < lowest.pricePerHour ? pricing : lowest, null,
          ))
        } catch { /* Pricing is optional, as it is on the list. */ }
      }
    } catch (error) {
      if (!isCurrent()) return
      const fallback = t("rentals.resources.loadError")
      const message = mapRbacErrorMessage(error instanceof Error ? error.message : fallback, fallback)
      setLoadError(message)
      toast.error(message)
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [id, canReadPricing, t])

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => { if (current) return load(() => current) })
    return () => { current = false }
  }, [load])

  async function handleSubmit(values: RentalResourceFormValues): Promise<boolean> {
    if (!canWrite || saveInFlight.current) return false
    const currentLifetime = lifetime.current
    saveInFlight.current = true
    setBusy(true)
    try {
      const body = toCreateRentableRequest(values, {
        creating: editing === null,
        stored: editing?.maxAdvanceBookingDays,
        storedVisualTemplateRevisionId: editing?.visualTemplateRevisionId,
        storedCapacityPeople: editing?.capacityPeople,
      })
      if (editing) {
        const saved = await updateRentalAsset(editing.id, body)
        if (!currentLifetime.active) return false
        if (body.cancelCutoffHours !== undefined && (saved.cancelCutoffHours ?? null) !== body.cancelCutoffHours) {
          toast.error(t("rentals.resources.cutoffNotSaved"))
          saveInFlight.current = false
          setBusy(false)
          return false
        }
        toast.success(t("rentals.resources.updateSuccess"))
      } else {
        await createRentalAsset(body)
        if (!currentLifetime.active) return false
        toast.success(t("rentals.resources.createSuccess"))
      }
      setSaved(true)
      redirectTimer.current = setTimeout(() => navigate(RESOURCES_PATH), 3000)
      return true
    } catch (error) {
      if (!currentLifetime.active) return false
      toast.error(error instanceof Error ? error.message : t(editing ? "rentals.resources.updateError" : "rentals.resources.createError"))
      saveInFlight.current = false
      setBusy(false)
      return false
    }
  }

  if (loading) return <Skeleton className="h-96 w-full" role="status" aria-label={t("common.loading")} />
  if (loadError) return <div className="space-y-4"><ErrorState message={loadError} onRetry={() => void load()} /><Link to={RESOURCES_PATH}>{t("rentals.resources.title")}</Link></div>

  return <>
    {hasDataRouter ? <RouterLeaveGuard dirty={dirty && !saved} saving={busy && !saved} /> : null}
    <LeaveConfirmation open={confirmCancel} onStay={() => setConfirmCancel(false)}
      onLeave={() => navigate(RESOURCES_PATH)} />
    <RentalResourceEditorForm key={id ?? "new"} editing={editing} units={units} categories={categories} families={families}
    busy={busy} readOnly={!canWrite} pricePerHour={price?.pricePerHour} pricingUnit={price?.pricingUnit}
    onDirtyChange={setDirty}
    onCancel={() => {
      if (saveInFlight.current) return
      if (!hasDataRouter && dirty && !saved) setConfirmCancel(true)
      else navigate(RESOURCES_PATH)
    }} onSubmit={handleSubmit} />
  </>
}
