import type { Processor } from '@mastra/core/processors';

/** A processor that reads/injects context before the model runs. */
export type InputProc = Processor & Required<Pick<Processor, 'processInput'>>;
/** A processor that persists what happened after the model finishes. */
export type OutputProc = Processor & Required<Pick<Processor, 'processOutputResult'>>;
import type { ToolsInput } from '@mastra/core/agent';

/**
 * An extension is a self-contained capability that attendees switch on
 * one at a time (see `EXTENSIONS` in `.env`). It can contribute any of:
 *
 *  - `tools`       extra tools the agent can call
 *  - `inputProcessors`   run before the model: inject remembered context
 *  - `outputProcessors`  run after it: persist what happened
 *  - `instructions` extra lines appended to the agent's system prompt
 *  - `setup`       one-off schema setup, run by `npm run extensions:setup`
 */
export interface Extension {
  id: string;
  title: string;
  description: string;
  /** Environment variables this extension needs. */
  requires?: string[];
  setup?: () => Promise<void>;
  tools?: ToolsInput;
  inputProcessors?: InputProc[];
  outputProcessors?: OutputProc[];
  instructions?: string;
}
