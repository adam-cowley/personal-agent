/**
 * Persona registry — driven by config/personas/*.yaml.
 *
 * To add a new persona:
 *   1. Create config/personas/<id>.yaml with id, name, provider, model, instructions, etc.
 *   2. That's it — the persona will appear in the selector automatically.
 */

import { loadPersonaSpecs, loadPersonaSpec } from "@/lib/spec/loader"
import type { PersonaWithInstructions, Persona } from "./types"

export function getAllPersonas(): PersonaWithInstructions[] {
  return loadPersonaSpecs() as PersonaWithInstructions[]
}

export function getPersona(id: string): PersonaWithInstructions | undefined {
  const spec = loadPersonaSpec(id)
  if (!spec) return undefined
  return spec as PersonaWithInstructions
}

export const DEFAULT_PERSONA_ID = "elsie"

/**
 * Build the system prompt for a persona, optionally injecting runtime context.
 * Replaces {{mbtiTargetContext}} and {{peopleContext}} placeholders.
 */
export function buildSystemPrompt(
  persona: PersonaWithInstructions,
  context: {
    targetMbti?: string
    people?: PersonaSummary[]
  } = {}
): string {
  let prompt = persona.instructions

  const mbtiTargetContext = context.targetMbti
    ? `\nTarget person MBTI: **${context.targetMbti}**`
    : ""

  const peopleContext = context.people && context.people.length > 0
    ? `\nPeople from the user's network:\n${context.people.map(p =>
        `- ${p.name}${p.role ? ` (${p.role})` : ""}${p.notes ? `: ${p.notes}` : ""}`
      ).join("\n")}`
    : ""

  prompt = prompt.replace("{{mbtiTargetContext}}", mbtiTargetContext)
  prompt = prompt.replace("{{peopleContext}}", peopleContext)

  return prompt
}

interface PersonaSummary {
  id: string
  name: string
  role?: string
  notes?: string
}

/** Strip to client-safe Persona (no instructions) */
export function toClientPersona(p: PersonaWithInstructions): Persona {
  const { instructions: _i, ...rest } = p
  return rest as Persona
}
