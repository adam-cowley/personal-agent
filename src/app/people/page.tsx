import { AppShell } from "@/components/layout/AppShell"
import { PersonCard } from "@/components/entities/PersonCard"
import { runQuery } from "@/lib/neo4j/client"

async function getPeople() {
  try {
    return await runQuery<{
      person: { id: string; name: string; email: string; role: string }
      projects: string[]
      activeTasks: number
    }>(`
      MATCH (p:Person)
      OPTIONAL MATCH (p)-[:WORKS_ON]->(proj:Project)
      OPTIONAL MATCH (p)-[:ASSIGNED_TO]->(t:Task {status: 'in_progress'})
      RETURN p {.id, .name, .email, .role} AS person,
             collect(DISTINCT proj.name) AS projects,
             count(DISTINCT t) AS activeTasks
      ORDER BY p.name
    `)
  } catch {
    return []
  }
}

export default async function PeoplePage() {
  const people = await getPeople()

  return (
    <AppShell>
      <div className="p-4 space-y-3 overflow-y-auto h-full">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          People ({people.length})
        </h2>
        {people.length === 0 ? (
          <p className="text-base text-muted-foreground py-8 text-center">
            No people yet. Ask Elsie to add someone.
          </p>
        ) : (
          people.map(({ person, projects, activeTasks }) => (
            <PersonCard
              key={person.id}
              person={person}
              projects={projects}
              activeTasks={activeTasks}
            />
          ))
        )}
      </div>
    </AppShell>
  )
}
