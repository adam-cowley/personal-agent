import type { Skill } from '@/lib/skills/types'
import { getDailyDigestData, getWeeklyDigestData, saveDigest } from './queries'
import { runChat } from '@/lib/models/adapter'
import { DEFAULT_MODEL } from '@/lib/models/types'

async function generateDigest(type: 'daily' | 'weekly'): Promise<string> {
  const data = type === 'daily' ? await getDailyDigestData() : await getWeeklyDigestData()

  let content = ''
  for await (const event of runChat({
    model: DEFAULT_MODEL,
    system: 'You are a concise business digest generator.',
    messages: [{
      role: 'user',
      content: `Generate a ${type} digest from this data. Be concise, actionable, and highlight what needs attention.\n\n${JSON.stringify(data, null, 2)}`,
    }],
    tools: [], // digest generation doesn't need tools
  })) {
    if (event.type === 'text_delta' && event.text) content += event.text
  }

  await saveDigest(type, content)
  return content
}

export const digestSkill: Skill = {
  name: 'digest',
  description: 'Generate daily and weekly digests summarizing activity and priorities',
  tools: [
    {
      definition: {
        name: 'generate_daily_digest',
        description: 'Generate a daily briefing with overdue tasks, tasks due today, and in-progress work',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      handler: async () => generateDigest('daily'),
    },
    {
      definition: {
        name: 'generate_weekly_digest',
        description: 'Generate a weekly summary of project progress, completed tasks, and team activity',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      handler: async () => generateDigest('weekly'),
    },
    {
      definition: {
        name: 'get_daily_data',
        description: 'Get raw daily digest data (overdue, due today, in-progress tasks) without generating a summary',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      handler: async () => JSON.stringify(await getDailyDigestData(), null, 2),
    },
  ],
}
