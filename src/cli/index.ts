#!/usr/bin/env node
/**
 * Elsie CLI
 *
 * Usage:
 *   npm run cli -- <command> [options]
 *
 * Commands:
 *   db:setup          Initialize Neo4j schema (constraints + indexes)
 *   db:seed           Seed demo data
 *   digest:daily      Generate and print a daily digest
 *   digest:weekly     Generate and print a weekly digest
 *   scheduler         Start the background scheduler (daily + weekly digests)
 */

import { setupSchema, seedDemoData } from '../lib/neo4j/schema'
import { getDailyDigestData, getWeeklyDigestData, saveDigest } from '../skills/digest/queries'
import { runChat } from '../lib/models/adapter'
import { DEFAULT_MODEL } from '../lib/models/types'
import { closeDriver } from '../lib/neo4j/client'

const command = process.argv[2]

async function generateDigestContent(type: 'daily' | 'weekly') {
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
  return content
}

async function main() {
  switch (command) {
    case 'db:setup':
      console.log('Setting up Neo4j schema...')
      await setupSchema()
      console.log('Done.')
      break

    case 'db:seed':
      console.log('Seeding demo data...')
      await setupSchema()
      await seedDemoData()
      console.log('Done.')
      break

    case 'digest:daily': {
      console.log('Generating daily digest...')
      const content = await generateDigestContent('daily')
      await saveDigest('daily', content)
      console.log('\n--- Daily Digest ---\n')
      console.log(content)
      break
    }

    case 'digest:weekly': {
      console.log('Generating weekly digest...')
      const content = await generateDigestContent('weekly')
      await saveDigest('weekly', content)
      console.log('\n--- Weekly Digest ---\n')
      console.log(content)
      break
    }

    case 'scheduler': {
      const { startScheduler } = await import('./scheduler')
      startScheduler()
      process.stdin.resume()
      return // Don't close driver — scheduler keeps running
    }

    default:
      console.log(`
Elsie CLI

Commands:
  db:setup          Initialize Neo4j schema
  db:seed           Seed demo data (includes db:setup)
  digest:daily      Generate a daily digest
  digest:weekly     Generate a weekly digest
  scheduler         Start background scheduler
      `.trim())
  }

  await closeDriver()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
