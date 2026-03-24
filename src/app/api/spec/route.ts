/**
 * GET /api/spec — returns client-safe entity configs and personas.
 * Entity CRUD methods and Neo4j details are stripped; only UI-relevant fields remain.
 */

import { NextResponse } from "next/server"
import { loadGraphSpec } from "@/lib/spec/loader"
import { loadPersonaSpecs } from "@/lib/spec/loader"
import type { ClientEntityConfig } from "@/entities/client-config"

type RawOptions =
  | Record<string, { label: string; description?: string }>
  | Array<{ value: string; label: string; description?: string }>
  | undefined

function normalizeOptions(options: RawOptions): Array<{ value: string; label: string; description?: string }> | undefined {
  if (!options) return undefined
  if (Array.isArray(options)) return options
  return Object.entries(options).map(([value, { label, description }]) => ({ value, label, description }))
}

export async function GET() {
  try {
    const graphSpec = loadGraphSpec()
    const personaSpecs = loadPersonaSpecs()

    // Build client-safe entity configs from nodes that have ui extensions
    const entities: ClientEntityConfig[] = Object.entries(graphSpec.nodes)
      .filter(([, nodeSpec]) => !!nodeSpec.extensions?.ui)
      .map(([nodeLabel, nodeSpec]) => {
        const ui = nodeSpec.extensions!.ui!
        return {
          type: nodeLabel,
          label: ui.label,
          plural: ui.plural,
          iconName: ui._icon,
          fields: ui.fields.map(f => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            placeholder: f.placeholder,
            options: normalizeOptions(f.options),
            endpoint: f.endpoint,
            labelKey: f.labelKey,
            valueKey: f.valueKey,
          })),
          groups: ui._groups,
        }
      })

    // Strip instructions from personas (server-only)
    const personas = personaSpecs.map(({ instructions: _i, ...rest }) => rest)

    return NextResponse.json({ entities, personas })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
