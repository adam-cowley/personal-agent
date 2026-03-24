export type PersonaCategory = "default" | "persona" | "coach" | "panel"

export interface PersonaSummary {
  id: string
  name: string
  role?: string
  notes?: string
}

/** Client-safe persona definition (no server imports) */
export interface Persona {
  id: string
  name: string
  description: string
  category: PersonaCategory
  mbti?: string | null
  enneagram?: string | null
  provider: "anthropic" | "openai" | "gemini"
  model: string
  welcomeMessage: string
  /** If true, UI shows MBTI picker before activating */
  requiresMbtiTarget?: boolean
}

/** Server-side persona with full instructions */
export interface PersonaWithInstructions extends Persona {
  instructions: string
}
