import {
  menuDeepLink,
  scheduleDeepLink,
  type ResourceWizardStepId,
} from "@/features/rentals/components/resourceWizard/wizardSteps"

export type ChecklistAsset = {
  id: string
  type: "Location" | "Good"
  isActive: boolean
  schedulePolicy: "SlotGrid" | "OpenHours"
  openTime?: string | null
  closeTime?: string | null
  queueEnabled: boolean
  queueOpeningTime?: string | null
}

export type ChecklistMenuItem = {
  moduleName: string
  isActive: boolean
  rentalAssetId?: string | null
}

export type ChecklistKind = {
  isActive: boolean
  isBookableByCustomer: boolean
}

export type ChecklistTemplate = {
  isActive: boolean
}

export type ChecklistPrice = {
  pricePerHour: number
}

export type BookableChecklistAccess = {
  menuRead: boolean
  menuWrite: boolean
  kindsRead: boolean
  kindsWrite: boolean
  scheduleRead: boolean
  pricingRead: boolean
}

export type BookableChecklistInput = {
  asset: ChecklistAsset
  menuItems: readonly ChecklistMenuItem[] | null
  kinds: readonly ChecklistKind[] | null
  templates: readonly ChecklistTemplate[] | null
  prices: readonly ChecklistPrice[] | null
  access: BookableChecklistAccess
  wizardPath: string
}

export type ChecklistItemId =
  | "portalMenu"
  | "occupancyKinds"
  | "schedule"
  | "price"
  | "queue"

export type ChecklistItemStatus = "done" | "missing" | "unavailable" | "notApplicable"

export type ChecklistAction =
  | { kind: "none" }
  | { kind: "step"; step: ResourceWizardStepId }
  | { kind: "link"; href: string }
  | { kind: "createMenu" }
  | { kind: "createKind" }

export type ChecklistItem = {
  id: ChecklistItemId
  status: ChecklistItemStatus
  blocksBooking: boolean
  action: ChecklistAction
}

export type BookableSummary = "ready" | "missing" | "unknown" | "inactive"

function hasText(value: string | null | undefined): boolean {
  return (value?.trim().length ?? 0) > 0
}

export function menuCoversAsset(
  item: ChecklistMenuItem,
  rentalAssetId: string,
): boolean {
  if (!item.isActive || item.moduleName.trim().toLowerCase() !== "rentals") {
    return false
  }
  const scoped = item.rentalAssetId?.trim() ?? ""
  return scoped.length === 0 || scoped === rentalAssetId
}

function portalItem(input: BookableChecklistInput): ChecklistItem {
  const href = menuDeepLink(input.wizardPath)
  if (!input.access.menuRead || input.menuItems === null) {
    return {
      id: "portalMenu",
      status: "unavailable",
      blocksBooking: true,
      action: { kind: "none" },
    }
  }
  if (input.menuItems.some((item) => menuCoversAsset(item, input.asset.id))) {
    return {
      id: "portalMenu",
      status: "done",
      blocksBooking: true,
      action: { kind: "link", href },
    }
  }
  if (input.access.menuWrite) {
    return {
      id: "portalMenu",
      status: "missing",
      blocksBooking: true,
      action: { kind: "createMenu" },
    }
  }
  return {
    id: "portalMenu",
    status: "missing",
    blocksBooking: true,
    action: { kind: "link", href },
  }
}

function hasBookableKind(kinds: readonly ChecklistKind[]): boolean {
  return kinds.some((kind) => kind.isActive && kind.isBookableByCustomer)
}

function kindsItem(input: BookableChecklistInput): ChecklistItem {
  const href = scheduleDeepLink(input.asset.id, "tipos", input.wizardPath)
  const openHours = input.asset.schedulePolicy === "OpenHours"
  if (!openHours && (!input.access.kindsRead || input.kinds === null)) {
    return {
      id: "occupancyKinds",
      status: "unavailable",
      blocksBooking: true,
      action: { kind: "none" },
    }
  }
  if (input.kinds !== null && hasBookableKind(input.kinds)) {
    return {
      id: "occupancyKinds",
      status: "done",
      blocksBooking: !openHours,
      action: { kind: "link", href },
    }
  }
  if (openHours) {
    return {
      id: "occupancyKinds",
      status: "notApplicable",
      blocksBooking: false,
      action: input.access.kindsRead ? { kind: "link", href } : { kind: "none" },
    }
  }
  if (input.access.kindsWrite) {
    return {
      id: "occupancyKinds",
      status: "missing",
      blocksBooking: true,
      action: { kind: "createKind" },
    }
  }
  return {
    id: "occupancyKinds",
    status: "missing",
    blocksBooking: true,
    action: { kind: "link", href },
  }
}

function scheduleItem(input: BookableChecklistInput): ChecklistItem {
  if (input.asset.schedulePolicy === "OpenHours") {
    const ready = hasText(input.asset.openTime) && hasText(input.asset.closeTime)
    return {
      id: "schedule",
      status: ready ? "done" : "missing",
      blocksBooking: true,
      action: input.access.scheduleRead
        ? { kind: "step", step: "rules" }
        : { kind: "none" },
    }
  }
  if (!input.access.scheduleRead || input.templates === null) {
    return {
      id: "schedule",
      status: "unavailable",
      blocksBooking: true,
      action: { kind: "none" },
    }
  }
  return {
    id: "schedule",
    status: input.templates.some((template) => template.isActive) ? "done" : "missing",
    blocksBooking: true,
    action: { kind: "step", step: "rules" },
  }
}

function priceItem(input: BookableChecklistInput): ChecklistItem {
  if (!input.access.pricingRead || input.prices === null) {
    return {
      id: "price",
      status: "unavailable",
      blocksBooking: true,
      action: { kind: "none" },
    }
  }
  const priced = input.prices.some((price) => price.pricePerHour > 0)
  return {
    id: "price",
    status: priced ? "done" : "missing",
    blocksBooking: true,
    action: { kind: "step", step: "prices" },
  }
}

function queueItem(input: BookableChecklistInput): ChecklistItem {
  if (input.asset.type !== "Location") {
    return {
      id: "queue",
      status: "notApplicable",
      blocksBooking: false,
      action: { kind: "none" },
    }
  }
  if (!input.asset.queueEnabled) {
    return {
      id: "queue",
      status: "done",
      blocksBooking: false,
      action: { kind: "step", step: "prices" },
    }
  }
  if (!hasText(input.asset.queueOpeningTime)) {
    return {
      id: "queue",
      status: "missing",
      blocksBooking: true,
      action: { kind: "step", step: "prices" },
    }
  }
  return {
    id: "queue",
    status: "done",
    blocksBooking: false,
    action: { kind: "step", step: "prices" },
  }
}

export function buildBookableChecklist(
  input: BookableChecklistInput,
): ChecklistItem[] {
  return [
    portalItem(input),
    kindsItem(input),
    scheduleItem(input),
    priceItem(input),
    queueItem(input),
  ]
}

export function bookableSummary(
  assetIsActive: boolean,
  items: readonly ChecklistItem[],
): BookableSummary {
  if (!assetIsActive) {
    return "inactive"
  }
  const blocking = items.filter((item) => item.blocksBooking)
  if (blocking.some((item) => item.status === "unavailable")) {
    return "unknown"
  }
  if (blocking.some((item) => item.status !== "done")) {
    return "missing"
  }
  return "ready"
}
