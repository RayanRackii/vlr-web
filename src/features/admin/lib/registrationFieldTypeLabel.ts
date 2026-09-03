import { FIELD_TYPE_OPTIONS } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

export function registrationFieldTypeLabelKey(fieldType: string): string {
  const isKnown = (FIELD_TYPE_OPTIONS as readonly string[]).includes(fieldType)
  return isKnown
    ? `admin.registrationFields.types.${fieldType}`
    : fieldType
}
