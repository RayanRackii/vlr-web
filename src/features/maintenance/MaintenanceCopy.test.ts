import { expect, it } from "vitest"
import i18n from "@/lib/i18n"
it.each([
  ["pt-BR", "Manutenção", "Este plano está inativo e não pode gerar ordens."],
  ["en", "Maintenance", "This plan is inactive and cannot generate work orders."],
  ["es", "Mantenimiento", "Este plan está inactivo y no puede generar órdenes."],
])("resolves root maintenance copy in %s", (lng, title, unavailable) => {
  expect(i18n.t("nav.manutencao", { lng })).toBe(title)
  expect(i18n.t("maintenance.planUnavailable", { lng })).toBe(unavailable)
})
