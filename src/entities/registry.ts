/**
 * Entity Registry — driven by config/graph.yaml.
 *
 * To add a new entity type:
 *   1. Add a node to config/graph.yaml with labels, properties, and extensions.ui
 *   2. That's it — CRUD, forms, and system prompt context are generated automatically.
 *
 * The registry is used by:
 *   - The hamburger menu (icons + labels)
 *   - The entity list/CRUD pages (/e/[type])
 *   - The system prompt (descriptions)
 *   - The API route (/api/entities/[type])
 *   - Chat entity extraction
 */

import { buildAllEntityDefs } from "@/lib/spec/entity-crud"
import type { EntityDef } from "./types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const entities: EntityDef<any>[] = buildAllEntityDefs()

export function getEntity(type: string): EntityDef | undefined {
  return entities.find(e => e.type.toLowerCase() === type.toLowerCase())
}

/** System prompt fragment describing all entity types */
export function entitySystemContext(): string {
  return [
    "The following entity types exist in the knowledge graph:",
    ...entities.map(e => `- ${e.plural} (${e.type}): ${e.description}. Fields: ${e.fields.map(f => f.key).join(", ")}`),
  ].join("\n")
}
