import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const snapshotPath = path.join(repositoryRoot, "openapi", "openapi.json")
const outputPath = path.join(repositoryRoot, "src", "api", "generated", "rentalsReadiness.ts")
const pricingOutputPath = path.join(repositoryRoot, "src", "api", "generated", "rentalPricing.ts")

function zodForSchema(schema, schemas) {
  if (schema.$ref) {
    const name = schema.$ref.replace("#/components/schemas/", "")
    return `${name[0].toLowerCase()}${name.slice(1)}Schema${schema.nullable ? ".nullable()" : ""}`
  }

  let result
  if (schema.enum) {
    result = schema.enum.every((value) => typeof value === "string")
      ? `z.enum(${JSON.stringify(schema.enum)})`
      : `z.union([${schema.enum.map((value) => `z.literal(${JSON.stringify(value)})`).join(", ")}])`
  } else if (schema.type === "array") {
    result = `z.array(${zodForSchema(schema.items, schemas)})`
  } else if (schema.type === "integer") {
    result = "z.number().int()"
  } else if (schema.type === "number") {
    result = "z.number()"
  } else if (schema.type === "boolean") {
    result = "z.boolean()"
  } else if (schema.type === "string") {
    result = "z.string()"
  } else {
    throw new Error(`Unsupported OpenAPI schema type: ${schema.type ?? "unknown"}`)
  }

  if (schema.nullable) result += ".nullable()"
  return result
}

function objectSchema(name, schema, schemas) {
  if (schema.type !== "object" || !schema.properties) {
    throw new Error(`Expected ${name} to be an object schema.`)
  }

  const required = new Set(schema.required ?? [])
  const properties = Object.entries(schema.properties)
    .map(([propertyName, propertySchema]) => {
      let result = zodForSchema(propertySchema, schemas)
      if (!required.has(propertyName)) result += ".optional()"
      return `  ${propertyName}: ${result},`
    })
    .join("\n")

  const schemaName = `${name[0].toLowerCase()}${name.slice(1)}Schema`
  return `export const ${schemaName} = z.object({\n${properties}\n})`
}

function generatedSource(openapi) {
  const schemas = openapi.components?.schemas
  const endpoint = openapi.paths?.["/api/rentals/readiness"]?.get
  const responseRef = endpoint?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref

  if (!schemas || responseRef !== "#/components/schemas/RentalsReadinessResponse") {
    throw new Error("OpenAPI snapshot is missing GET /api/rentals/readiness.")
  }

  return `// generated from openapi/openapi.json; do not edit.\nimport type { AxiosInstance } from "axios"\nimport { z } from "zod"\n\n${objectSchema("RentalsReadinessItem", schemas.RentalsReadinessItem, schemas)}\n\n${objectSchema("RentalsReadinessResponse", schemas.RentalsReadinessResponse, schemas)}\n\nexport type RentalsReadinessResponse = z.infer<typeof rentalsReadinessResponseSchema>\n\nexport async function getRentalsReadinessResponse(client: AxiosInstance) {\n  return client.get<unknown>("/api/rentals/readiness")\n}\n`
}

const openapi = JSON.parse(await readFile(snapshotPath, "utf8"))
const source = generatedSource(openapi)
const pricingSchemas = ["AvailabilityWindowDto", "BulkPricingRowDto", "CheckAvailabilityResponseDto", "CreateRentalPricingDto", "RentalPricingResponseDto", "UpdateRentalPricingDto"]
const schemas = openapi.components.schemas
const pricingSource = `// generated from openapi/openapi.json; do not edit.\nimport { z } from "zod"\n\n${["PricingUnit", "DayOfWeek", "AvailabilityWindowState"].map((name) => `export const ${name[0].toLowerCase()}${name.slice(1)}Schema = ${zodForSchema(schemas[name], schemas)}`).join("\n")}\n\nexport type PricingUnit = z.infer<typeof pricingUnitSchema>\n\n${pricingSchemas.map((name) => `${objectSchema(name, schemas[name], schemas)}\n\nexport type ${name} = z.infer<typeof ${name[0].toLowerCase()}${name.slice(1)}Schema>`).join("\n\n")}\n`

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "")
  const currentPricing = await readFile(pricingOutputPath, "utf8").catch(() => "")
  if (current !== source || currentPricing !== pricingSource) {
    console.error("Generated API client is stale. Run npm run gen:api.")
    process.exitCode = 1
  } else {
    console.log("Generated API client is up to date.")
  }
} else {
  await writeFile(outputPath, source)
  await writeFile(pricingOutputPath, pricingSource)
  console.log("Generated src/api/generated/rentalsReadiness.ts")
  console.log("Generated src/api/generated/rentalPricing.ts")
}
