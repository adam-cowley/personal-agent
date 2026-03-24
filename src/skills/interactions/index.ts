import type { Skill } from "@/lib/skills/types"

export const interactionsSkill: Skill = {
  name: "interactions",
  description: "Tools for structured user interaction — presenting choices, confirmations, and forms",
  tools: [
    {
      definition: {
        name: "present_choices",
        description: `Present the user with a set of options to choose from. Use this whenever you need the user to make a decision — instead of listing options in plain text, call this tool to show them as interactive buttons. The user's selection will be sent back to you as their next message.

Use "multiple": true when the user can select more than one option (e.g. "tick all that apply"). Use "multiple": false (the default) for single-choice decisions.`,
        input_schema: {
          type: "object" as const,
          properties: {
            question: {
              type: "string",
              description: "The question or prompt shown above the options",
            },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id:          { type: "string", description: "Short unique key for this option" },
                  label:       { type: "string", description: "Primary label shown on the button" },
                  description: { type: "string", description: "Optional sub-text below the label" },
                },
                required: ["id", "label"],
              },
              description: "The list of choices to present",
            },
            multiple: {
              type: "boolean",
              description: "If true, user can select multiple options (checkboxes). Defaults to false (radio).",
            },
          },
          required: ["question", "options"],
        },
      },
      handler: async (input) => {
        const { question, options, multiple = false } = input as {
          question: string
          options: Array<{ id: string; label: string; description?: string }>
          multiple?: boolean
        }
        return JSON.stringify({
          __choiceForm: true,
          question,
          options,
          multiple,
          __aiMessage: `A choice form has been shown to the user with the question: "${question}". Their selection will arrive in the next message.`,
        })
      },
    },
  ],
}
