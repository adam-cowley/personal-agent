import type { Skill } from '@/lib/skills/types'
import { listProjects, getProject, createProject, updateProject, addMemberToProject } from './queries'

export const projectsSkill: Skill = {
  name: 'projects',
  description: 'Manage projects and team membership in the knowledge graph',
  tools: [
    {
      definition: {
        name: 'list_projects',
        description: 'List all projects with member counts and task progress',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      handler: async () => JSON.stringify(await listProjects(), null, 2),
    },
    {
      definition: {
        name: 'get_project',
        description: 'Get full details for a project including all members and tasks',
        input_schema: {
          type: 'object' as const,
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      handler: async ({ id }) => JSON.stringify(await getProject(id as string), null, 2),
    },
    {
      definition: {
        name: 'create_project',
        description: 'Show the user a pre-filled form to create a new project. The user will review, edit if needed, and confirm.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'paused', 'completed', 'cancelled'] },
          },
          required: ['name'],
        },
      },
      handler: async (input) => JSON.stringify({
        __entityForm: true,
        entityType: 'project',
        prefilled: input,
        __aiMessage: `A pre-filled form has been shown to the user to create a project named "${input.name}". They will review and confirm.`,
      }),
    },
    {
      definition: {
        name: 'update_project',
        description: 'Update fields on a project',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string' },
          },
          required: ['id'],
        },
      },
      handler: async ({ id, ...data }) => JSON.stringify(await updateProject(id as string, data), null, 2),
    },
    {
      definition: {
        name: 'add_member_to_project',
        description: 'Add a person to a project team',
        input_schema: {
          type: 'object' as const,
          properties: {
            personId: { type: 'string' },
            projectId: { type: 'string' },
          },
          required: ['personId', 'projectId'],
        },
      },
      handler: async ({ personId, projectId }) =>
        JSON.stringify(await addMemberToProject(personId as string, projectId as string), null, 2),
    },
  ],
}
