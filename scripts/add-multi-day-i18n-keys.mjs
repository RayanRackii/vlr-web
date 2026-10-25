import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(dirname, "..", "src", "locales")

const copyByLocale = {
  "pt-BR": {
    days: "Dias",
    daysSummary: "{{count}} dias · até {{until}}",
    multiDayRange: "{{start}} – {{end}} ({{days}} dias)",
  },
  en: {
    days: "Days",
    daysSummary: "{{count}} days · until {{until}}",
    multiDayRange: "{{start}} – {{end}} ({{days}} days)",
  },
  es: {
    days: "Días",
    daysSummary: "{{count}} días · hasta {{until}}",
    multiDayRange: "{{start}} – {{end}} ({{days}} días)",
  },
}

for (const [locale, copy] of Object.entries(copyByLocale)) {
  const filePath = path.join(localesDir, locale, "common.json")
  const original = readFileSync(filePath, "utf8")

  const agendaAnchor = /("cancelCutoffReason": "[^"]*")\n(\s+)\},/
  if (!agendaAnchor.test(original)) {
    throw new Error(`agenda anchor not found in ${filePath}`)
  }
  let patched = original.replace(
    agendaAnchor,
    (_match, prevLine, indent) =>
      `${prevLine},\n${indent}  "days": ${JSON.stringify(copy.days)},\n${indent}  "daysSummary": ${JSON.stringify(copy.daysSummary)}\n${indent}},`,
  )

  const reservationsAnchor = /("Completed": "[^"]*")\n(\s+)\}\n(\s+)\},/
  if (!reservationsAnchor.test(patched)) {
    throw new Error(`reservations anchor not found in ${filePath}`)
  }
  patched = patched.replace(
    reservationsAnchor,
    (_match, prevLine, closeIndent, outerIndent) =>
      `${prevLine}\n${closeIndent}},\n${closeIndent}"multiDayRange": ${JSON.stringify(copy.multiDayRange)}\n${outerIndent}},`,
  )

  JSON.parse(patched)
  writeFileSync(filePath, patched)
  console.log(`Patched ${filePath}`)
}
