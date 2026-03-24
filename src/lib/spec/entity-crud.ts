/**
 * Generates EntityDef objects from graph.yaml node specs.
 * Server-only — imports Neo4j client.
 *
 * Cypher strategy: simple flat queries only.
 * Relations are handled as separate runQuery calls after the main CREATE/UPDATE,
 * never as multi-step WITH chains in a single query.
 */

import "server-only"
import { randomUUID } from "crypto"
import { runQuery } from "@/lib/neo4j/client"
import { loadGraphSpec } from "./loader"
import type { EntityDef, FieldDef } from "@/entities/types"
import type { NodeSpec, RelationshipSpec } from "./types"
import { getIcon } from "./icon-map"

// ── Relation field metadata ───────────────────────────────────────────────────

interface RelFieldMeta {
  key: string
  relationshipType: string
  targetLabel: string
  direction: "outbound" | "inbound"
}

function getRelFields(nodeLabel: string, relationships: Record<string, RelationshipSpec>): RelFieldMeta[] {
  const spec = loadGraphSpec()
  const fields = spec.nodes[nodeLabel]?.extensions?.ui?.fields ?? []
  return fields
    .filter(f => f.type === "relation" && f.relationship)
    .flatMap(f => {
      const relSpec = relationships[f.relationship!]
      if (!relSpec) return []
      const direction = relSpec.from === nodeLabel ? "outbound" : "inbound"
      const targetLabel = direction === "outbound" ? relSpec.to : relSpec.from
      return [{ key: f.key, relationshipType: relSpec.type, targetLabel, direction }]
    })
}

// ── Cypher helpers ────────────────────────────────────────────────────────────

/** OPTIONAL MATCH lines for each relation field */
function optionalMatchLines(alias: string, relFields: RelFieldMeta[]): string {
  return relFields.map(rf => {
    const pattern = rf.direction === "outbound"
      ? `(${alias})-[:${rf.relationshipType}]->(${rf.key}_rel:${rf.targetLabel})`
      : `(${alias})<-[:${rf.relationshipType}]-(${rf.key}_rel:${rf.targetLabel})`
    return `OPTIONAL MATCH ${pattern}`
  }).join("\n    ")
}

/** Map projection that includes relation IDs as extra fields */
function returnProjection(alias: string, relFields: RelFieldMeta[]): string {
  if (relFields.length === 0) return `${alias} {.*}`
  const extra = relFields.map(rf => `${rf.key}: ${rf.key}_rel.id`).join(", ")
  return `${alias} {.*, ${extra}}`
}

// ── Field def helpers ─────────────────────────────────────────────────────────

function normalizeOptions(
  options: Record<string, { label: string; description?: string }> | Array<{ value: string; label: string; description?: string }> | undefined
): Array<{ value: string; label: string; description?: string }> | undefined {
  if (!options) return undefined
  if (Array.isArray(options)) return options
  return Object.entries(options).map(([value, { label, description }]) => ({ value, label, description }))
}

function toFieldDefs(nodeSpec: NodeSpec): FieldDef[] {
  return (nodeSpec.extensions?.ui?.fields ?? []).map(f => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder,
    options: normalizeOptions(f.options),
    endpoint: f.endpoint,
    labelKey: f.labelKey,
    valueKey: f.valueKey,
  }))
}

// ── Relation write helpers ────────────────────────────────────────────────────

/** Replace a single relationship: delete any existing, create new if targetId provided */
async function setRelation(
  nodeLabel: string,
  nodeId: string,
  rf: RelFieldMeta,
  targetId: string | null
) {
  // Delete existing
  const delPattern = rf.direction === "outbound"
    ? `(n:${nodeLabel} {id: $nodeId})-[r:${rf.relationshipType}]->(:${rf.targetLabel})`
    : `(n:${nodeLabel} {id: $nodeId})<-[r:${rf.relationshipType}]-(:${rf.targetLabel})`
  await runQuery(`MATCH ${delPattern} DELETE r`, { nodeId })

  if (targetId) {
    const relPattern = rf.direction === "outbound"
      ? `(n)-[:${rf.relationshipType}]->(t)`
      : `(n)<-[:${rf.relationshipType}]-(t)`
    await runQuery(
      `MATCH (n:${nodeLabel} {id: $nodeId}), (t:${rf.targetLabel} {id: $targetId}) MERGE ${relPattern}`,
      { nodeId, targetId }
    )
  }
}

// ── EntityDef factory ─────────────────────────────────────────────────────────

export function buildEntityDef(nodeLabel: string): EntityDef {
  const spec = loadGraphSpec()
  const nodeSpec = spec.nodes[nodeLabel]
  if (!nodeSpec) throw new Error(`Node "${nodeLabel}" not found in graph spec`)

  const ui = nodeSpec.extensions?.ui
  if (!ui) throw new Error(`Node "${nodeLabel}" has no ui extensions`)

  const relFields = getRelFields(nodeLabel, spec.relationships)
  const relKeys = new Set(relFields.map(r => r.key))
  const alias = "n"

  // Scalar property keys (excludes id and relation field keys)
  const scalarKeys = Object.keys(nodeSpec.properties).filter(k => k !== "id" && !relKeys.has(k))

  return {
    type: nodeLabel,
    label: ui.label,
    plural: ui.plural,
    icon: getIcon(ui._icon),
    description: nodeSpec.extensions?.reasoningHint ?? "",
    fields: toFieldDefs(nodeSpec),
    groups: ui._groups,

    displayName: (item) => String(item[ui.displayName] ?? item.id ?? ""),
    displaySub: ui.displaySub ? (item) => String(item[ui.displaySub!] ?? "") : undefined,

    async list() {
      const optMatches = optionalMatchLines(alias, relFields)
      const projection = returnProjection(alias, relFields)
      const orderKey = ui.displayName ?? "id"
      const query = [
        `MATCH (${alias}:${nodeLabel})`,
        optMatches,
        `RETURN ${projection} AS result`,
        `ORDER BY ${alias}.${orderKey}`,
      ].filter(Boolean).join("\n    ")
      const rows = await runQuery<{ result: Record<string, unknown> }>(query)
      return rows.map(r => r.result)
    },

    async get(id) {
      const optMatches = optionalMatchLines(alias, relFields)
      const projection = returnProjection(alias, relFields)
      const query = [
        `MATCH (${alias}:${nodeLabel} {id: $id})`,
        optMatches,
        `RETURN ${projection} AS result`,
      ].filter(Boolean).join("\n    ")
      const rows = await runQuery<{ result: Record<string, unknown> }>(query, { id })
      return rows[0]?.result ?? null
    },

    async create(data) {
      const id = randomUUID()
      const props = scalarKeys
        .map(k => `${k}: $${k}`)
        .join(", ")
      const params: Record<string, unknown> = { id }
      for (const k of scalarKeys) params[k] = data[k] ?? null

      const rows = await runQuery<{ result: Record<string, unknown> }>(
        `CREATE (${alias}:${nodeLabel} {id: $id, ${props}, createdAt: datetime()}) RETURN ${alias} {.*} AS result`,
        params
      )
      const created = rows[0]?.result
      if (!created) throw new Error("Create returned no result")

      // Handle relations as separate queries
      for (const rf of relFields) {
        const targetId = data[rf.key] ? String(data[rf.key]) : null
        if (targetId) await setRelation(nodeLabel, id, rf, targetId)
      }

      return { ...created, ...Object.fromEntries(relFields.map(rf => [rf.key, data[rf.key] ?? null])) }
    },

    async update(id, data) {
      const scalarData: Record<string, unknown> = {}
      for (const k of scalarKeys) {
        if (k in data) scalarData[k] = data[k]
      }

      const rows = await runQuery<{ result: Record<string, unknown> }>(
        `MATCH (${alias}:${nodeLabel} {id: $id}) SET ${alias} += $data, ${alias}.updatedAt = datetime() RETURN ${alias} {.*} AS result`,
        { id, data: scalarData }
      )
      const updated = rows[0]?.result
      if (!updated) throw new Error("Update returned no result")

      // Handle relations as separate queries
      for (const rf of relFields) {
        if (rf.key in data) {
          const targetId = data[rf.key] ? String(data[rf.key]) : null
          await setRelation(nodeLabel, id, rf, targetId)
        }
      }

      return { ...updated, ...Object.fromEntries(relFields.map(rf => [rf.key, data[rf.key] ?? null])) }
    },

    async delete(id) {
      await runQuery(`MATCH (${alias}:${nodeLabel} {id: $id}) DETACH DELETE ${alias}`, { id })
    },
  }
}

/** Build EntityDef objects for all nodes that have ui extensions */
export function buildAllEntityDefs(): EntityDef[] {
  const spec = loadGraphSpec()
  return Object.entries(spec.nodes)
    .filter(([, nodeSpec]) => !!nodeSpec.extensions?.ui)
    .map(([label]) => buildEntityDef(label))
}
