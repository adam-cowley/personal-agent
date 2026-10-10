import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { agent } from './agents/agent';

// Agent memory is NOT stored here (see src/mastra/memory and src/mastra/extensions).
// This local database is only used by Mastra Studio for its own bookkeeping.
export const mastra = new Mastra({
  agents: { agent },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: process.env.TURSO_DATABASE_URL || 'file:./mastra.db',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  }),
});
