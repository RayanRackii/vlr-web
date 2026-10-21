import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { ESLint } from "eslint"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const baselinePath = path.join(repositoryRoot, ".eslint-baseline.json")

function optionValue(option) {
  const index = process.argv.indexOf(option)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function lint() {
  return new ESLint({ cwd: repositoryRoot }).lintFiles(["."])
}

function countViolations(report) {
  const counts = {}
  for (const file of report) {
    const filePath = path.relative(repositoryRoot, file.filePath).split(path.sep).join("/")
    for (const message of file.messages) {
      if (message.severity === 0) continue
      const rule = message.ruleId ?? "fatal"
      counts[filePath] ??= {}
      counts[filePath][rule] = (counts[filePath][rule] ?? 0) + 1
    }
  }

  return Object.fromEntries(
    Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([file, rules]) => [
        file,
        Object.fromEntries(Object.entries(rules).sort(([left], [right]) => left.localeCompare(right))),
      ]),
  )
}

function totalViolations(counts) {
  return Object.values(counts).reduce(
    (total, rules) => total + Object.values(rules).reduce((sum, count) => sum + count, 0),
    0,
  )
}

async function readBaseline(filePath) {
  const baseline = JSON.parse(await readFile(filePath, "utf8"))

  if (
    baseline?.version !== 2 ||
    !baseline.files ||
    typeof baseline.files !== "object" ||
    Array.isArray(baseline.files) ||
    Object.entries(baseline.files).some(
      ([file, rules]) =>
        !file ||
        !rules ||
        typeof rules !== "object" ||
        Array.isArray(rules) ||
        Object.entries(rules).some(
          ([rule, count]) => !rule || !Number.isInteger(count) || count < 0,
        ),
    )
  ) {
    throw new Error(`Invalid ESLint baseline at ${filePath}: expected v2 file+rule format.`)
  }

  return baseline
}

function regressionsAgainstBaseline(counts, baseline) {
  const regressions = []

  for (const [file, rules] of Object.entries(counts)) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = baseline.files?.[file]?.[rule] ?? 0
      if (count > allowed) regressions.push(`${file} (${rule}): ${allowed} -> ${count}`)
    }
  }
  return regressions
}

function baselineRegressions(candidate, base) {
  const regressions = []
  for (const [file, rules] of Object.entries(candidate.files ?? {})) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = base.files?.[file]?.[rule] ?? 0
      if (count > allowed) regressions.push(`${file} (${rule}): ${allowed} -> ${count}`)
    }
  }
  return regressions
}

const counts = countViolations(await lint())

if (process.argv.includes("--write-baseline")) {
  await writeFile(
    baselinePath,
    `${JSON.stringify({ version: 2, files: counts }, null, 2)}\n`,
  )
  console.log(`Wrote ESLint baseline with ${totalViolations(counts)} violations.`)
  process.exit(0)
}

const selectedBaselinePath = optionValue("--baseline") ?? baselinePath
const baseline = await readBaseline(selectedBaselinePath)
const candidateBaselinePath = optionValue("--verify-baseline")
const regressions = regressionsAgainstBaseline(counts, baseline)

if (candidateBaselinePath) {
  const candidateBaseline = await readBaseline(candidateBaselinePath)
  regressions.push(
    ...regressionsAgainstBaseline(counts, candidateBaseline).map(
      (regression) => `candidate baseline ${regression}`,
    ),
    ...baselineRegressions(candidateBaseline, baseline).map(
      (regression) => `baseline ${regression}`,
    ),
  )
}

if (regressions.length > 0) {
  console.error("New ESLint violations exceed the base baseline:")
  for (const regression of regressions) console.error(`- ${regression}`)
  process.exit(1)
}

console.log(`ESLint ratchet passed (${totalViolations(counts)} existing violations at or below baseline).`)
