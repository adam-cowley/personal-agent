import type { Skill } from '@/lib/skills/types'
import { listPeople, getPerson, createPerson, updatePerson, searchPeople, connectPeople } from './queries'

export const peopleSkill: Skill = {
  name: 'people',
  description: 'Manage professional relationships and contacts in the knowledge graph',
  tools: [
    {
      definition: {
        name: 'list_people',
        description: 'List all people in the knowledge graph with their active projects and tasks',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      handler: async () => JSON.stringify(await listPeople(), null, 2),
    },
    {
      definition: {
        name: 'get_person',
        description: 'Get full details for a person including their projects, tasks, and connections',
        input_schema: {
          type: 'object' as const,
          properties: { id: { type: 'string', description: 'Person ID' } },
          required: ['id'],
        },
      },
      handler: async ({ id }) => JSON.stringify(await getPerson(id as string), null, 2),
    },
    {
      definition: {
        name: 'create_person',
        description: 'Show the user a pre-filled form to create a new person. The user will review, edit if needed, and confirm.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['name'],
        },
      },
      handler: async (input) => JSON.stringify({
        __entityForm: true,
        entityType: 'person',
        prefilled: input,
        __aiMessage: `A pre-filled form has been shown to the user to create a person named "${input.name}". They will review and confirm.`,
      }),
    },
    {
      definition: {
        name: 'update_person',
        description: 'Update fields on an existing person',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['id'],
        },
      },
      handler: async ({ id, ...data }) => JSON.stringify(await updatePerson(id as string, data), null, 2),
    },
    {
      definition: {
        name: 'search_people',
        description: 'Full-text search across person names, emails, and notes',
        input_schema: {
          type: 'object' as const,
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
      handler: async ({ query }) => JSON.stringify(await searchPeople(query as string), null, 2),
    },
    {
      definition: {
        name: 'connect_people',
        description: 'Create a KNOWS relationship between two people',
        input_schema: {
          type: 'object' as const,
          properties: {
            fromId: { type: 'string' },
            toId: { type: 'string' },
          },
          required: ['fromId', 'toId'],
        },
      },
      handler: async ({ fromId, toId }) => JSON.stringify(await connectPeople(fromId as string, toId as string), null, 2),
    },
  ],
}
