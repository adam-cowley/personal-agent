import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface PersonCardProps {
  person: {
    id: string
    name: string
    email?: string | null
    role?: string | null
  }
  projects?: string[]
  activeTasks?: number
  onClick?: () => void
}

export function PersonCard({ person, projects = [], activeTasks = 0, onClick }: PersonCardProps) {
  const initials = person.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="flex-row items-center gap-4 space-y-0">
        <Avatar className="size-12">
          <AvatarFallback className="text-base font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <CardTitle>{person.name}</CardTitle>
          {person.role && <CardDescription>{person.role}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {projects.slice(0, 2).map(p => (
            <Badge key={p} variant="secondary">{p}</Badge>
          ))}
          {activeTasks > 0 && (
            <Badge variant="outline">{activeTasks} active task{activeTasks !== 1 ? "s" : ""}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
