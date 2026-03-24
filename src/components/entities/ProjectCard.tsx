import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  completed: "bg-blue-500",
  cancelled: "bg-red-500",
}

interface ProjectCardProps {
  project: {
    id: string
    name: string
    description?: string | null
    status: string
  }
  members?: Array<{ id: string; name: string }>
  taskCount?: number
  doneTasks?: number
  onClick?: () => void
}

export function ProjectCard({ project, members = [], taskCount = 0, doneTasks = 0, onClick }: ProjectCardProps) {
  const progress = taskCount > 0 ? Math.round((doneTasks / taskCount) * 100) : 0

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="flex-1 min-w-0">
          <CardTitle>{project.name}</CardTitle>
          {project.description && <CardDescription className="line-clamp-2">{project.description}</CardDescription>}
        </div>
        <Badge variant="outline" className="shrink-0 flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", statusColors[project.status] ?? "bg-gray-400")} />
          {project.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {taskCount > 0 && (
          <div>
            <div className="flex justify-between text-sm text-muted-foreground mb-1.5">
              <span>{doneTasks}/{taskCount} tasks done</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {members.slice(0, 3).map(m => (
            <Badge key={m.id} variant="secondary">{m.name.split(" ")[0]}</Badge>
          ))}
          {members.length > 3 && (
            <Badge variant="secondary">+{members.length - 3} more</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
