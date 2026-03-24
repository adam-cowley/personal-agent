import type { Skill } from '@/lib/skills/types'
import { listTasks, createTask, updateTask, assignTask, getOverdueTasks } from './queries'

export const tasksSkill: Skill = {
  name: 'tasks',
  description: 'Create, update, and track tasks and their assignments',
  tools: [
    {
      definition: {
        name: 'list_tasks',
        description: 'List tasks, optionally filtered by status, priority, or project',
        input_schema: {
          type: 'object' as const,
          properties: {
            status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'blocked'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            projectId: { type: 'string' },
          },
          required: [],
        },
      },
      handler: async (input) => JSON.stringify(await listTasks(input as Parameters<typeof listTasks>[0]), null, 2),
    },
    {
      definition: {
        name: 'create_task',
        description: 'Show the user a pre-filled form to create a new task. The user will review, edit if needed, and confirm.',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'blocked'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            dueDate: { type: 'string', description: 'ISO date string YYYY-MM-DD' },
            projectId: { type: 'string' },
            assigneeId: { type: 'string' },
          },
          required: ['title'],
        },
      },
      handler: async (input) => JSON.stringify({
        __entityForm: true,
        entityType: 'task',
        prefilled: input,
        __aiMessage: `A pre-filled form has been shown to the user to create a task titled "${input.title}". They will review and confirm.`,
      }),
    },
    {
      definition: {
        name: 'update_task',
        description: 'Update task fields (status, priority, title, description, dueDate)',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string' },
            priority: { type: 'string' },
            dueDate: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['id'],
        },
      },
      handler: async ({ id, ...data }) => JSON.stringify(await updateTask(id as string, data), null, 2),
    },
    {
      definition: {
        name: 'assign_task',
        description: 'Assign a task to a person',
        input_schema: {
          type: 'object' as const,
          properties: {
            taskId: { type: 'string' },
            personId: { type: 'string' },
          },
          required: ['taskId', 'personId'],
        },
      },
      handler: async ({ taskId, personId }) =>
        JSON.stringify(await assignTask(taskId as string, personId as string), null, 2),
    },
    {
      definition: {
        name: 'get_overdue_tasks',
        description: 'Get all tasks that are past their due date and not done',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      handler: async () => JSON.stringify(await getOverdueTasks(), null, 2),
    },
  ],
}
