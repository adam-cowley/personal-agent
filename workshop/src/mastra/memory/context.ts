import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import type { MastraDBMessage } from '@mastra/core/agent';

/** Minimal shape of what processors receive; avoids leaking Mastra generics everywhere. */
type Ctx = {
  requestContext?: { get: (k: string) => unknown };
  messages?: MastraDBMessage[];
};

export function threadIdOf(ctx: Ctx): string {
  const fromCtx = ctx.requestContext?.get(MASTRA_THREAD_ID_KEY);
  if (typeof fromCtx === 'string') return fromCtx;
  return ctx.messages?.find((m) => m.threadId)?.threadId ?? 'default';
}

export function resourceIdOf(ctx: Ctx): string {
  const fromCtx = ctx.requestContext?.get(MASTRA_RESOURCE_ID_KEY);
  return typeof fromCtx === 'string' ? fromCtx : 'default';
}

export function textOf(m: MastraDBMessage): string {
  return m.content.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
    .trim();
}

export function lastUserText(messages: MastraDBMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return textOf(messages[i]);
  return '';
}

/**
 * Stable ids for the two messages of a turn, derived from the user message's id.
 * Short-term memory and context traces both compute these, so they can point at the
 * same (:Message) nodes without knowing about each other or the order they run in.
 */
export function turnIds(messages: MastraDBMessage[]): { userId: string; assistantId: string } {
  const user = [...messages].reverse().find((m) => m.role === 'user');
  const userId = user?.id ?? `${threadIdOf({ messages })}:${Date.now()}`;
  return { userId, assistantId: `${userId}:assistant` };
}
