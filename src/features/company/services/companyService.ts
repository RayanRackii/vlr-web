import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"
import {
  companyProfileSchema,
  type CompanyProfile,
  type CompanyWriteBody,
} from "@/features/company/schemas/companySchemas"

function parseProfile(data: unknown): CompanyProfile {
  const parsed = companyProfileSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidResponse"))
  }
  return parsed.data
}

/** The current tenant's company profile. Any staff member may read it. */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  try {
    const response = await api.get("/api/company")
    return parseProfile(response.data)
  } catch (error) {
    throw new Error(parseApiError(getAxiosErrorPayload(error), i18n.t("company.loadError")), { cause: error })
  }
}

/** Needs core.company.write. */
export async function updateCompanyProfile(body: CompanyWriteBody): Promise<CompanyProfile> {
  try {
    const response = await api.put("/api/company", body)
    return parseProfile(response.data)
  } catch (error) {
    throw new Error(parseApiError(getAxiosErrorPayload(error), i18n.t("company.saveError")), { cause: error })
  }
}
