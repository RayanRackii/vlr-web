import { useTranslation } from "react-i18next"

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
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("staffProfile.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("staffProfile.description")}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">
              {nameInitials(currentUser.fullName)}
            </AvatarFallback>
          </Avatar>
          <p className="min-w-0 truncate text-base font-semibold">
            {currentUser.fullName}
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyValue
          label={t("staffProfile.name")}
          value={currentUser.fullName}
        />
        <ReadOnlyValue
          label={t("staffProfile.email")}
          value={currentUser.email}
        />
        {roleNames.length > 0 ? (
          <ReadOnlyValue
            label={t("staffProfile.roles")}
            value={roleNames.join(", ")}
            className="sm:col-span-2"
          />
        ) : null}
      </div>
    </div>
  )
}
