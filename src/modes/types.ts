import type { LucideIcon } from "lucide-react"

export interface PersonSummary {
  id: string
  name: string
  role?: string
  notes?: string
}

export type ModeCategory = "default" | "persona" | "coach" | "panel"

export interface Mode {
  id: string
  label: string
  description: string
  icon: LucideIcon
  category: ModeCategory
  welcomeMessage: string
  /** If true, user must select people from graph before activating */
  requiresPeople?: boolean
  /** Build the persona portion of the system prompt */
  buildSystemPrompt(people: PersonSummary[], context?: Record<string, unknown>): string
}
