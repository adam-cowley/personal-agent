import { AppShell } from "@/components/layout/AppShell"
import { TaskCard } from "@/components/entities/TaskCard"
import { runQuery } from "@/lib/neo4j/client"

async function getTasks() {
  try {
    return await runQuery<{
      task: { id: string; title: string; status: string; priority: string; dueDate: string }
      project: { id: string; name: string } | null
      assignees: Array<{ id: string; name: string }>
    }>(`
      MATCH (t:Task)
      OPTIONAL MATCH (t)-[:PART_OF]->(proj:Project)
      OPTIONAL MATCH (person:Person)-[:ASSIGNED_TO]->(t)
      RETURN t {.id, .title, .status, .priority, .dueDate} AS task,
             proj {.id, .name} AS project,
             collect(person {.id, .name}) AS assignees
      ORDER BY
        CASE t.status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END,
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
    `)
  } catch {
    return []
  }
}

export default async function TasksPage() {
  const tasks = await getTasks()

  return (
    <AppShell>
      <div className="p-4 space-y-3 overflow-y-auto h-full">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Tasks ({tasks.length})
        </h2>
        {tasks.length === 0 ? (
          <p className="text-base text-muted-foreground py-8 text-center">
            No tasks yet. Ask Elsie to create one.
          </p>
        ) : (
          tasks.map(({ task, project, assignees }) => (
            <TaskCard
              key={task.id}
              task={task}
              project={project?.name}
              assignees={assignees.map(a => a.name)}
            />
          ))
        )}
      </div>
    </AppShell>
  )
}
