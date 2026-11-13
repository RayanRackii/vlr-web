/**
 * DEV seed for the agenda overview screen (Agendas -> Visao geral).
 *
 * Creates (idempotently, find-by-name) on DEV tenant `zzr14locacao`:
 *   - 3 resources (rental assets) open 08:00-22:00 on unit "Matriz",
 *   - 1 public catalog product per resource with a 180 min resource requirement,
 *   - 5 approved orders per day for 14 days starting 2026-11-13 (America/Sao_Paulo):
 *     Alfa 08:00 and 14:00, Beta 09:00 and 15:00, Gama 19:00 (3h each).
 * Today's first order (Alfa 08:00) is moved to `preparing` for status variety.
 *
 *
 * Slots whose start is already in the past are not seeded (the planner refuses to approve them), and
 * seeded allocations whose slot ended are walked start -> work-finished -> release so they stop
 * blocking the machine (ReservationOccupancy).
 *
 * Every order note carries `[seed-agenda] <day> <resource> <HH:mm>`; a rerun skips any slot that
 * already has a non-cancelled seeded order and only fills gaps.
 *
 * Run (needs `npm ci` and vlr-web/.env.e2e.local with E2E_WEB_URL, E2E_API_URL,
 * SMOKE_ZZR14_B2B_* and SMOKE_ZZR14_CUSTOMER_*):
 *   npm run seed:agenda:dev
 * Guards: refuses anything but https://rolvix-api-dev.fly.dev and tenant zzr14locacao.
 * Secrets and tokens are never printed. Nothing is ever deleted.
 */
import { chromium } from "@playwright/test"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const TENANT = "zzr14locacao"
const TENANT_ID = "c3968131-86c3-4ca3-9dee-c0d49df8d328" // zzr14locacao on DEV
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const REQUIRED_API = "https://rolvix-api-dev.fly.dev"
const TAG = "[seed-agenda]"
const START_DAY = "2026-11-13"
const DAYS = 14
const OFFSET = "-03:00" // America/Sao_Paulo has had no DST since 2019
const DURATION = 180

const RESOURCES = [
  { key: "alfa", name: "Impressora 3D Alfa", product: "Impressão 3D – Alfa (3h)", code: "SEED-ALFA" },
  { key: "beta", name: "Impressora 3D Beta", product: "Impressão 3D – Beta (3h)", code: "SEED-BETA" },
  { key: "gama", name: "Cortadora Laser Gama", product: "Corte a laser – Gama (3h)", code: "SEED-GAMA" },
]
const PATTERN = [
  { key: "alfa", time: "08:00" },
  { key: "beta", time: "09:00" },
  { key: "alfa", time: "14:00" },
  { key: "beta", time: "15:00" },
  { key: "gama", time: "19:00" },
]
const NOTES = ["Peça de reposição", "Protótipo cliente", "Brinde evento", "Suporte para bancada", "Lote de teste"]

function loadEnv() {
  const file = [process.env.SEED_ENV_FILE, path.join(REPO_ROOT, ".env.e2e.local")].find((f) => f && existsSync(f))
  if (!file) throw new Error("SEED_CONFIG_REQUIRED: .env.e2e.local not found")
  const env = {}
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  for (const k of ["E2E_WEB_URL", "E2E_API_URL", "SMOKE_ZZR14_B2B_EMAIL", "SMOKE_ZZR14_B2B_PASSWORD", "SMOKE_ZZR14_CUSTOMER_EMAIL", "SMOKE_ZZR14_CUSTOMER_PASSWORD"]) {
    if (!env[k]) throw new Error(`SEED_CONFIG_REQUIRED: missing ${k}`)
  }
  env.E2E_API_URL = env.E2E_API_URL.replace(/\/$/, "")
  env.E2E_WEB_URL = env.E2E_WEB_URL.replace(/\/$/, "")
  if (new URL(env.E2E_API_URL).host !== new URL(REQUIRED_API).host) {
    throw new Error("SEED_GUARD_BLOCKED: E2E_API_URL is not the DEV API")
  }
  const webHost = new URL(env.E2E_WEB_URL).host
  if (webHost.endsWith("rolvix.com.br") || !/^[a-z0-9-]+-vlr-solutions\.vercel\.app$/.test(webHost)) {
    throw new Error("SEED_GUARD_BLOCKED: E2E_WEB_URL is not a vlr-solutions DEV preview host")
  }
  return env
}

async function login(browser, env) {
  const staffCtx = await browser.newContext({ baseURL: env.E2E_WEB_URL })
  const staff = await staffCtx.newPage()
  await staff.goto("/login")
  await staff.getByLabel("E-mail").fill(env.SMOKE_ZZR14_B2B_EMAIL)
  await staff.getByLabel("Senha", { exact: true }).fill(env.SMOKE_ZZR14_B2B_PASSWORD)
  await staff.getByRole("button", { name: "Entrar" }).click()
  await staff.waitForURL(/\/(dashboard|admin)/, { timeout: 30_000 })
  const staffToken = await staff.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.includes("auth-token")) return JSON.parse(localStorage.getItem(k)).access_token
    }
    return null
  })
  await staffCtx.close()

  const custCtx = await browser.newContext({ baseURL: env.E2E_WEB_URL })
  const cust = await custCtx.newPage()
  await cust.goto(`/t/${TENANT}`)
  await cust.getByLabel("E-mail").fill(env.SMOKE_ZZR14_CUSTOMER_EMAIL)
  await cust.getByLabel("Senha", { exact: true }).fill(env.SMOKE_ZZR14_CUSTOMER_PASSWORD)
  await cust.getByRole("button", { name: /entrar/i }).click()
  await cust.waitForURL(new RegExp(`/t/${TENANT}/app`), { timeout: 30_000 })
  const customerToken = await cust.evaluate(() => localStorage.getItem("rolvix.customer.token"))
  await custCtx.close()
  if (!staffToken || !customerToken) throw new Error("SEED_AUTH_FAILED: could not read session tokens")
  return { staffToken, customerToken }
}

function client(env, token, extra = {}) {
  return async (method, p, body) => {
    const res = await fetch(env.E2E_API_URL + p, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { /* not json */ }
    return { status: res.status, json }
  }
}

function errCode(r) {
  const j = r.json ?? {}
  return `${r.status}${j.code ? ` ${j.code}` : j.title ? ` ${String(j.title).slice(0, 60)}` : ""}`
}
function must(r, what) {
  if (r.status < 200 || r.status >= 300) throw new Error(`${what} failed: ${errCode(r)}`)
  return r.json
}

function dayList() {
  const out = []
  const base = new Date(`${START_DAY}T12:00:00Z`)
  for (let i = 0; i < DAYS; i++) out.push(new Date(base.getTime() + i * 86_400_000).toISOString().slice(0, 10))
  return out
}

async function ensureSetup(staff, unitId) {
  const assets = must(await staff("GET", "/api/rental-assets"), "list rental assets")
  const categories = must(await staff("GET", "/api/rental-assets/categories"), "list categories")
  const families = must(await staff("GET", "/api/rental-assets/families"), "list families")
  const category = categories.find((c) => c.name === "QA goods") ?? categories[0]
  const family = families.find((f) => f.key === "goods")
  if (!category || !family) throw new Error("SEED_SETUP: no goods family or category on the tenant")
  const products = must(await staff("GET", "/api/catalog/products"), "list products")

  const resolved = {}
  for (const res of RESOURCES) {
    let asset = assets.find((a) => a.name === res.name)
    if (!asset) {
      asset = must(await staff("POST", "/api/rental-assets", {
        name: res.name, unitId, categoryId: category.id, familyId: family.id,
        rentalType: "Good", totalQuantity: 1, queueEnabled: false, requiresDeposit: false,
      }), `create resource ${res.name}`)
      console.log(`created resource ${res.name} ${asset.id}`)
    }
    // The planner rejects durations that the resource does not allow (unsupported_work_window).
    if (asset.schedulePolicy !== "OpenHours" || !(asset.allowedDurationMinutes ?? "").split(",").includes(String(DURATION))) {
      asset = must(await staff("PUT", `/api/rental-assets/${asset.id}/schedule-policy`, {
        schedulePolicy: "OpenHours", openTime: "08:00:00", closeTime: "22:00:00", allowedDurationMinutes: "60,120,180,240",
      }), `set schedule policy ${res.name}`)
      console.log(`set schedule policy for ${res.name}`)
    }
    let product = products.find((p) => p.name === res.product)
    if (!product) {
      product = must(await staff("POST", "/api/catalog/products", {
        name: res.product, code: res.code, price: 90, currency: "BRL",
        description: "Produto de seed para a agenda (DEV).",
      }), `create product ${res.product}`)
      console.log(`created product ${res.product} ${product.id}`)
    }
    const req = must(await staff("GET", `/api/catalog/products/${product.id}/resource-requirements`), "read requirements")
    const has = (req.requirements ?? []).some((r) => r.rentalAssetId === asset.id && r.durationMinutesPerUnit === DURATION)
    if (!has) {
      must(await staff("PUT", `/api/catalog/products/${product.id}/resource-requirements`, {
        expectedVersion: req.expectedVersion,
        requirements: [{ rentalAssetId: asset.id, resourceQuantity: 1, durationMinutesPerUnit: DURATION, prepMinutes: 0, cleanupMinutes: 0 }],
      }), `set requirements ${res.product}`)
      console.log(`set requirement for ${res.product}`)
    }
    if (product.isActive === false) must(await staff("POST", `/api/catalog/products/${product.id}/activate`), "activate product")
    if (product.visibility && product.visibility !== "Public") {
      throw new Error(`SEED_SETUP: product ${res.product} is not Public (${product.visibility}); not changing it`)
    }
    resolved[res.key] = { assetId: asset.id, assetName: res.name, productId: product.id }
  }
  return resolved
}

// A confirmed internal-use window whose end has passed keeps blocking its resource until it is
// released (ReservationOccupancy), so finished slots are walked start -> work-finished -> release.
async function finishAllocation(staff, orderId) {
  for (let i = 0; i < 4; i++) {
    const order = must(await staff("GET", `/api/catalog/orders/${orderId}`), "read order")
    const alloc = (order.items ?? []).map((it) => it.allocation).find(Boolean)
    if (!alloc || alloc.status === "Released" || alloc.status === "Cancelled") return
    const action = { Scheduled: "start", Running: "work-finished", Cleaning: "release" }[alloc.status]
    if (!action) throw new Error(`cannot finish allocation in status ${alloc.status}`)
    must(await staff("POST", `/api/catalog/orders/${orderId}/allocations/${alloc.id}/usage`, {
      action, expectedVersion: alloc.planningRevision,
    }), `usage ${action}`)
  }
  throw new Error("allocation did not reach a released state")
}

async function main() {
  const env = loadEnv()
  const browser = await chromium.launch()
  let tokens
  try { tokens = await login(browser, env) } finally { await browser.close() }
  const staff = client(env, tokens.staffToken)
  const customer = client(env, tokens.customerToken, { "X-Tenant-Subdomain": TENANT })

  const me = must(await staff("GET", "/api/users/me"), "users/me")
  if (me.tenantId !== TENANT_ID) throw new Error("SEED_GUARD_BLOCKED: staff user is not on the zzr14locacao test tenant")
  const units = must(await staff("GET", "/api/units"), "list units")
  const unit = units.find((u) => u.name === "Matriz")
  if (!unit) throw new Error("SEED_SETUP: unit Matriz not found")

  const setup = await ensureSetup(staff, unit.id)

  const existing = must(await staff("GET", "/api/catalog/orders"), "list orders")
  // key -> order for every live seeded order; a still-Requested one is approved (resume), others are skipped.
  const seeded = new Map()
  for (const o of existing) {
    if (o.status === "Cancelled" || o.status === "Rejected" || !o.customerNote?.startsWith(TAG)) continue
    seeded.set(o.customerNote.split(" | ")[0], o)
  }

  // Release seeded slots that already ended but still hold their machine.
  const nowMs = Date.now()
  let released = 0
  for (const o of existing) {
    if (!o.customerNote?.startsWith(TAG)) continue
    const alloc = (o.items ?? []).map((it) => it.allocation).find(Boolean)
    if (!alloc || !["Scheduled", "Running", "Cleaning"].includes(alloc.status)) continue
    if (new Date(alloc.plannedWorkEnd).getTime() > nowMs) continue
    await finishAllocation(staff, o.id)
    released++
  }
  if (released > 0) console.log(`released ${released} seeded allocation(s) whose slot already ended`)

  const summary = []
  let failed = 0
  const days = dayList()
  for (let d = 0; d < days.length; d++) {
    const day = days[d]
    const row = { day, created: 0, skipped: 0, past: 0, failed: [] }
    // vary creation order per day: rotate the pattern
    const order = PATTERN.map((_, i) => PATTERN[(i + d) % PATTERN.length])
    for (const slot of order) {
      const idx = PATTERN.indexOf(slot)
      const key = `${TAG} ${day} ${slot.key} ${slot.time}`
      const prior = seeded.get(key)
      if (prior && prior.status !== "Requested") { row.skipped++; continue }
      // The planner refuses to approve a window that has already started (resource_unavailable).
      if (new Date(`${day}T${slot.time}:00${OFFSET}`).getTime() <= nowMs) { row.past = (row.past ?? 0) + 1; continue }
      const r = setup[slot.key]
      try {
        const note = `${key} | ${NOTES[(d + idx) % NOTES.length]}`
        const created = prior ?? must(await customer("POST", "/api/catalog/portal/orders", {
          items: [{ productId: r.productId, quantity: 1 }], customerNote: note,
        }), "create order")
        const full = must(await staff("GET", `/api/catalog/orders/${created.id}`), "read order")
        const approved = must(await staff("POST", `/api/catalog/orders/${created.id}/approve`, {
          unitId: unit.id, workStart: `${day}T${slot.time}:00${OFFSET}`, expectedVersion: full.planningRevision ?? 0,
        }), "approve order")
        const endMs = new Date(`${day}T${slot.time}:00${OFFSET}`).getTime() + DURATION * 60_000
        if (endMs <= nowMs) {
          await finishAllocation(staff, approved.id)
        } else if (day === START_DAY && slot.key === "alfa" && slot.time === "08:00") {
          must(await staff("POST", `/api/catalog/orders/${approved.id}/preparing`), "mark preparing")
        }
        row.created++
      } catch (e) {
        row.failed.push(`${slot.key} ${slot.time}: ${e.message}`)
        failed++
      }
    }
    summary.push(row)
  }

  console.log("\nday         created skipped failed past-start")
  for (const r of summary) {
    console.log(`${r.day}  ${String(r.created).padStart(7)} ${String(r.skipped).padStart(7)} ${String(r.failed.length).padStart(6)} ${String(r.past)}`)
    for (const f of r.failed) console.log(`    ! ${f}`)
  }
  const tot = (k) => summary.reduce((a, r) => a + (k === "failed" ? r.failed.length : r[k]), 0)
  console.log(`TOTAL       ${String(tot("created")).padStart(7)} ${String(tot("skipped")).padStart(7)} ${String(tot("failed")).padStart(6)} ${String(tot("past"))}`)
  for (const [k, v] of Object.entries(setup)) console.log(`${k}: resource=${v.assetId} product=${v.productId}`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error(`SEED_FAILED: ${e.message}`); process.exit(1) })
