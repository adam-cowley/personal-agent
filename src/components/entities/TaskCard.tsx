import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react"

const statusIcons = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  blocked: AlertCircle,
}

const priorityColors = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-muted-foreground",
}

interface TaskCardProps {
  task: {
    id: string
    title: string
    status: string
    priority: string
    dueDate?: string | null
    description?: string | null
  }
  assignees?: string[]
  project?: string | null
  onClick?: () => void
}

export function TaskCard({ task, assignees = [], project, onClick }: TaskCardProps) {
  const StatusIcon = statusIcons[task.status as keyof typeof statusIcons] ?? Circle
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done"

  return (
    <Card
      className={cn("cursor-pointer hover:shadow-md transition-shadow", task.status === "done" && "opacity-60")}
      onClick={onClick}
    >
      <CardContent className="flex gap-3 pt-4">
        <StatusIcon className={cn("size-5 mt-0.5 shrink-0", priorityColors[task.priority as keyof typeof priorityColors])} />
        <div className="flex-1 min-w-0 space-y-2">
          <p className={cn("text-base font-medium leading-snug", task.status === "done" && "line-through text-muted-foreground")}>
            {task.title}
          </p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {project && <Badge variant="outline">{project}</Badge>}
            {assignees.slice(0, 2).map(a => (
              <Badge key={a} variant="secondary">{a.split(" ")[0]}</Badge>
            ))}
            {task.dueDate && (
              <span className={cn("text-sm", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                {isOverdue ? "Overdue · " : ""}{new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
