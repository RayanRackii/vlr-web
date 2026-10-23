import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const snapshotPath = path.join(repositoryRoot, "openapi", "openapi.json")
const outputPath = path.join(repositoryRoot, "src", "api", "generated", "rentalsReadiness.ts")

function zodForSchema(schema, schemas) {
  if (schema.$ref) {
    const name = schema.$ref.replace("#/components/schemas/", "")
    return `${name[0].toLowerCase()}${name.slice(1)}Schema`
  }

  let result
  if (schema.type === "array") {
    result = `z.array(${zodForSchema(schema.items, schemas)})`
  } else if (schema.type === "integer") {
    result = "z.number().int()"
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

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "")
  if (current !== source) {
    console.error("Generated API client is stale. Run npm run gen:api.")
    process.exitCode = 1
  } else {
    console.log("Generated API client is up to date.")
  }
} else {
  await writeFile(outputPath, source)
  console.log("Generated src/api/generated/rentalsReadiness.ts")
}
