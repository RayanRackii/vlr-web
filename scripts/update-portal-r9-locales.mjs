import { readFile, writeFile } from "node:fs/promises"

const updates = {
  "pt-BR": {
    pricePerHour: "{{amount}} por hora",
    unitsLeft: "{{left}} de {{total}} disponíveis",
  },
  en: {
    pricePerHour: "{{amount}} per hour",
    unitsLeft: "{{left}} of {{total}} available",
  },
  es: {
    pricePerHour: "{{amount}} por hora",
    unitsLeft: "{{left}} de {{total}} disponibles",
  },
}

await Promise.all(Object.entries(updates).map(async ([locale, bookingMap]) => {
  const path = new URL(`../src/locales/${locale}/common.json`, import.meta.url)
  const common = JSON.parse(await readFile(path, "utf8"))
  Object.assign(common.bookingMap, bookingMap)
  await writeFile(path, `${JSON.stringify(common, null, 2)}\n`)
}))
