import { chromium } from "@playwright/test"

import { ApiClient, expectStatus, type AdminTenant, type CurrentUser } from "./api-client"
import { loginB2b, loginCustomerUi } from "./auth-ui"
import {
  commercialOnly,
  canonicalModules,
  ensureAuthDirs,
  writeJson,
  type E2eContext,
  type TenantSnapshot,
} from "./context"
import {
  AUTH_DIR,
  B2B_STATE,
  B2C_STATE,
  CONTEXT_PATH,
  PLATFORM_ADMIN_STATE,
  SNAPSHOT_PATH,
  TOKENS_PATH,
  loadE2eEnv,
} from "./env"
import { extractCustomerAccessToken, extractSupabaseAccessToken } from "./context"
import { hasLegacyMaintenance } from "./tenant"

const ISOLATION_SLUG = "e2e-cert-isolation"
const ISOLATION_TAX_ID = "E2EISOLATION01"

export default async function globalSetup(): Promise<void> {
  const env = loadE2eEnv()
  if (!env.allowMutations) {
    throw new Error(
      "E2E_CONFIG_REQUIRED: certification requires E2E_ALLOW_MUTATIONS=true",
    )
  }
  if (!env.restoreOriginalTenantState) {
    throw new Error(
      "E2E_CONFIG_REQUIRED: certification requires E2E_RESTORE_ORIGINAL_TENANT_STATE=true",
    )
  }
  ensureAuthDirs()

  const runId = new Date().toISOString().replace(/[:.]/g, "-")
  const browser = await chromium.launch()

  try {
    const platformPage = await browser.newPage({ baseURL: env.webUrl })
    await loginB2b(
      platformPage,
      env.platformAdminEmail,
      env.platformAdminPassword,
    )
    await platformPage.context().storageState({ path: PLATFORM_ADMIN_STATE })
    await platformPage.close()

    const b2bPage = await browser.newPage({ baseURL: env.webUrl })
    await loginB2b(b2bPage, env.b2bEmail, env.b2bPassword)
    await b2bPage.context().storageState({ path: B2B_STATE })
    await b2bPage.close()

    const platformAdminToken = extractSupabaseAccessToken(PLATFORM_ADMIN_STATE)
    const b2bToken = extractSupabaseAccessToken(B2B_STATE)
    const admin = new ApiClient(platformAdminToken)
    const b2b = new ApiClient(b2bToken)

    const me = await b2b.get<CurrentUser>("/api/users/me")
    await expectStatus(me, 200, "B2B GET /api/users/me")
    if (!me.body?.tenantId) {
      throw new Error("E2E_CONFIG_REQUIRED: B2B user has no tenantId")
    }

    const tenantId = env.targetTenantId ?? me.body.tenantId
    const tenant = await admin.get<AdminTenant>(`/api/admin/tenants/${tenantId}`)
    await expectStatus(tenant, 200, "snapshot GET tenant")
    if (!tenant.body) {
      throw new Error("E2E_CONFIG_REQUIRED: target tenant not found")
    }

    const tenantSlug =
      env.targetTenantSlug ?? tenant.body.subdomain ?? ""
    if (!tenantSlug) {
      throw new Error("E2E_CONFIG_REQUIRED: target tenant has no subdomain")
    }

    const customerPage = await browser.newPage({ baseURL: env.webUrl })
    await loginCustomerUi(
      customerPage,
      tenantSlug,
      env.customerEmail,
      env.customerPassword,
    )
    await customerPage.context().storageState({ path: B2C_STATE })
    await customerPage.close()

    const customerToken = extractCustomerAccessToken(B2C_STATE)

    const menu = await admin.get(
      `/api/admin/tenants/${tenantId}/module-menu-items`,
    )
    const fields = await admin.get(
      `/api/admin/tenants/${tenantId}/registration-fields`,
    )

    const snapshot: TenantSnapshot = {
      id: tenant.body.id,
      legalName: tenant.body.legalName,
      taxId: tenant.body.taxId,
      subdomain: tenantSlug,
      logoSvg: tenant.body.logoSvg ?? null,
      primaryColor: tenant.body.primaryColor ?? null,
      accentColor: tenant.body.accentColor ?? null,
      welcomeTagline: tenant.body.welcomeTagline ?? null,
      commercialModules: commercialOnly(
        canonicalModules(
          tenant.body.activeModules.filter((module) => module.isActive),
        ),
      ),
      familyKeys: [...tenant.body.assetFamilyKeys],
      hasLegacyMaintenance: hasLegacyMaintenance(tenant.body),
      menuItems: menu.body ?? [],
      registrationFields: fields.body ?? [],
    }

    const isolation = await ensureIsolationTenant(admin)

    const context: E2eContext = {
      runId,
      tenantId: snapshot.id,
      tenantSlug,
      isolationTenantId: isolation.id,
      isolationTenantSlug: isolation.slug,
      isolationCreatedThisRun: isolation.created,
    }

    writeJson(SNAPSHOT_PATH, snapshot)
    writeJson(CONTEXT_PATH, context)
    writeJson(TOKENS_PATH, {
      platformAdmin: platformAdminToken,
      b2b: b2bToken,
      customer: customerToken,
    })
    writeJson(`${AUTH_DIR}/setup-ok.json`, {
      runId,
      tenantId: snapshot.id,
      isolationTenantId: isolation.id,
      isolationCreatedThisRun: isolation.created,
    })
  } finally {
    await browser.close()
  }
}

async function ensureIsolationTenant(
  admin: ApiClient,
): Promise<{ id: string; slug: string; created: boolean }> {
  const list = await admin.get<AdminTenant[]>("/api/admin/tenants")
  await expectStatus(list, 200, "list tenants for isolation")
  const existing = (list.body ?? []).find(
    (tenant) => tenant.subdomain === ISOLATION_SLUG,
  )
  if (existing) {
    return { id: existing.id, slug: ISOLATION_SLUG, created: false }
  }

  const created = await admin.post<AdminTenant>("/api/admin/tenants", {
    legalName: "E2E Isolation Tenant",
    taxId: ISOLATION_TAX_ID,
    subdomain: ISOLATION_SLUG,
    activeModules: ["catalog"],
    assetFamilyKeys: ["generic"],
  })

  if (created.status === 201 && created.body) {
    return { id: created.body.id, slug: ISOLATION_SLUG, created: true }
  }

  if (created.status === 409) {
    const retry = await admin.get<AdminTenant[]>("/api/admin/tenants")
    const found = (retry.body ?? []).find(
      (tenant) => tenant.subdomain === ISOLATION_SLUG,
    )
    if (found) {
      return { id: found.id, slug: ISOLATION_SLUG, created: false }
    }
  }

  throw new Error(
    `PERSISTENT_E2E_TENANT_CREATED blocked: could not reuse isolation tenant (${created.status} ${created.text.slice(0, 200)})`,
  )
}
