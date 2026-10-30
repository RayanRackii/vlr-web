import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { nameInitials, ReadOnlyValue } from "@/components/profile/profileFields"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

export function StaffProfilePage() {
  const { t } = useTranslation()
  const { currentUser, isLoading, error } = usePermissions()

  if (isLoading) {
    return <PageContentSkeleton rows={4} />
  }

  if (error || currentUser === null) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error ?? t("users.errors.loadCurrent")}
      </p>
    )
  }

  const roleNames = currentUser.roles
    .map((role) => role.name.trim())
    .filter((name) => name.length > 0)

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-6">
      <PageHeader
        title={t("staffProfile.title")}
        description={t("staffProfile.description")}
        className="mb-0 sm:mb-0"
      />

      <Card className="min-w-0 motion-reduce:transition-none">
        <CardContent className="flex min-w-0 items-center gap-4">
          <Avatar className="size-16 shrink-0">
            <AvatarFallback className="text-lg">
              {nameInitials(currentUser.fullName)}
            </AvatarFallback>
          </Avatar>
          <p className="min-w-0 break-words text-base font-semibold [overflow-wrap:anywhere]">
            {currentUser.fullName}
          </p>
        </CardContent>
      </Card>

      <Card className="min-w-0 motion-reduce:transition-none">
        <CardContent className="grid min-w-0 gap-4 sm:grid-cols-2">
          <ReadOnlyValue
            label={t("staffProfile.name")}
            value={currentUser.fullName}
            className="min-w-0 [overflow-wrap:anywhere]"
          />
          <ReadOnlyValue
            label={t("staffProfile.email")}
            value={currentUser.email}
            className="min-w-0 [overflow-wrap:anywhere]"
          />
          {roleNames.length > 0 ? (
            <ReadOnlyValue
              label={t("staffProfile.roles")}
              value={roleNames.join(", ")}
              className="min-w-0 [overflow-wrap:anywhere] sm:col-span-2"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
