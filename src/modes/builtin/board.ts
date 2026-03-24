import { Users } from "lucide-react"
import type { Mode, PersonSummary } from "../types"

export const boardMode: Mode = {
  id: "board",
  label: "Virtual Board of Directors",
  description: "Get perspectives from a panel of advisors — pick people from your network",
  icon: Users,
  category: "panel",
  requiresPeople: true,
  welcomeMessage: "Your board is assembled. Bring your question — each member will weigh in from their own perspective, then we'll synthesise.",
  buildSystemPrompt: (people: PersonSummary[]) => {
    const members = people.map(p => {
      const lines = [`**${p.name}**${p.role ? ` — ${p.role}` : ""}`]
      if (p.notes) lines.push(`Background: ${p.notes}`)
      return lines.join("\n")
    }).join("\n\n")

    return `You are facilitating a virtual board of directors session. For every question or topic the user raises, you respond as each board member in turn, in their own voice, drawing on their background and expertise.

Board members:
${members}

Response format — use this structure exactly:
---
**[Name]**: [Their perspective, 2-4 sentences in their voice]

**[Name]**: [Their perspective, 2-4 sentences in their voice]

(repeat for each member)

---
**Synthesis**: [2-3 sentences identifying the key themes, tensions, or consensus across the board]

Each member speaks authentically from their domain and background. They may agree, disagree, or add nuance. Keep each response tight and characterful — no generic boardroom filler.`
  },
}
