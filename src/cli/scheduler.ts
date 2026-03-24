/**
 * Background scheduler for Elsie.
 *
 * Schedules:
 *   Daily digest    — weekdays at 8:00 AM
 *   Weekly digest   — Mondays at 8:30 AM
 */

import cron from 'node-cron'
import { getDailyDigestData, getWeeklyDigestData, saveDigest } from '../skills/digest/queries'
import { runChat } from '../lib/models/adapter'
import { DEFAULT_MODEL } from '../lib/models/types'

async function runDigest(type: 'daily' | 'weekly') {
  console.log(`[scheduler] Starting ${type} digest — ${new Date().toISOString()}`)
  try {
    const data = type === 'daily' ? await getDailyDigestData() : await getWeeklyDigestData()
    let content = ''
    for await (const event of runChat({
      model: DEFAULT_MODEL,
      system: 'You are a concise business digest generator.',
      messages: [{
        role: 'user',
        content: `Generate a ${type} digest from this data. Be concise, actionable, and highlight what needs attention.\n\n${JSON.stringify(data, null, 2)}`,
      }],
      tools: [],
    })) {
      if (event.type === 'text_delta' && event.text) content += event.text
    }
    await saveDigest(type, content)
    console.log(`[scheduler] ${type} digest saved — ${new Date().toISOString()}`)
    console.log(content)
  } catch (err) {
    console.error(`[scheduler] ${type} digest failed:`, err)
  }
}

export function startScheduler() {
  console.log('[scheduler] Starting Elsie scheduler...')

  cron.schedule('0 8 * * 1-5', () => runDigest('daily'), {
    timezone: process.env.TZ || 'America/New_York',
  })

  cron.schedule('30 8 * * 1', () => runDigest('weekly'), {
    timezone: process.env.TZ || 'America/New_York',
  })

  console.log('[scheduler] Scheduled: daily digest weekdays 8:00 AM, weekly digest Mondays 8:30 AM')
  console.log(`[scheduler] Timezone: ${process.env.TZ || 'America/New_York'} (set TZ env var to change)`)
}
