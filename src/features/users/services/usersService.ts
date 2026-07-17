import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import {
  currentUserSchema,
  technicianUserListSchema,
  type CurrentUser,
  type TechnicianUser,
} from "@/features/users/schemas/userSchemas"

const USERS_PATH = "/api/users"

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const response = await api.get<unknown>(`${USERS_PATH}/me`)
    return currentUserSchema.parse(response.data)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("users.errors.loadCurrent"),
      ),
    )
  }
}

export async function getTechnicians(): Promise<TechnicianUser[]> {
  try {
    const response = await api.get<unknown>(`${USERS_PATH}/technicians`)
    return technicianUserListSchema.parse(response.data)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("users.errors.loadTechnicians"),
      ),
    )
  }
}
