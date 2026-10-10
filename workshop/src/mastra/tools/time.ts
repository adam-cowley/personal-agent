import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/** A trivial tool so there is something to show up in the context traces. */
export const currentTimeTool = createTool({
  id: 'get_current_time',
  description: 'Get the current date and time, optionally in a given IANA timezone.',
  inputSchema: z.object({ timezone: z.string().default('UTC').describe('IANA timezone, e.g. Europe/London') }),
  execute: async ({ timezone }) => ({
    timezone,
    now: new Date().toLocaleString('en-GB', { timeZone: timezone, dateStyle: 'full', timeStyle: 'long' }),
  }),
});
