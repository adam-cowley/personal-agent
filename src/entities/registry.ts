/**
 * Entity Registry — the single source of truth for all entity types.
 *
 * To add a new entity type:
 *   1. Create src/entities/<name>.ts exporting an EntityDef
 *   2. Add it to the `entities` array below
 *
 * The registry is used by:
 *   - The hamburger menu (icons + labels)
 *   - The entity list/CRUD pages (/e/[type])
 *   - The system prompt (descriptions)
 *   - The API route (/api/entities/[type])
 *   - Chat entity extraction
 */

import { personEntity } from "./person"
import { projectEntity } from "./project"
import { taskEntity } from "./task"
import type { EntityDef } from "./types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const entities: EntityDef<any>[] = [
  personEntity,
  projectEntity,
  taskEntity,
]

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
