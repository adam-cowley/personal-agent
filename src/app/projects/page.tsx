import { AppShell } from "@/components/layout/AppShell"
import { ProjectCard } from "@/components/entities/ProjectCard"
import { runQuery } from "@/lib/neo4j/client"

async function getProjects() {
  try {
    return await runQuery<{
      project: { id: string; name: string; description: string; status: string }
      members: Array<{ id: string; name: string }>
      taskCount: number
      doneTasks: number
    }>(`
      MATCH (p:Project)
      OPTIONAL MATCH (person:Person)-[:WORKS_ON]->(p)
      OPTIONAL MATCH (t:Task)-[:PART_OF]->(p)
      RETURN p {.id, .name, .description, .status} AS project,
             collect(DISTINCT person {.id, .name}) AS members,
             count(DISTINCT t) AS taskCount,
             count(DISTINCT CASE WHEN t.status = 'done' THEN t END) AS doneTasks
      ORDER BY p.name
    `)
  } catch {
    return []
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <AppShell>
      <div className="p-4 space-y-3 overflow-y-auto h-full">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Projects ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="text-base text-muted-foreground py-8 text-center">
            No projects yet. Ask Elsie to create one.
          </p>
        ) : (
          projects.map(({ project, members, taskCount, doneTasks }) => (
            <ProjectCard
              key={project.id}
              project={project}
              members={members}
              taskCount={Number(taskCount)}
              doneTasks={Number(doneTasks)}
            />
          ))
        )}
      </div>
    </AppShell>
  )
}
