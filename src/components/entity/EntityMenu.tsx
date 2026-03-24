"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { Menu, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getIcon } from "@/lib/spec/icon-map"
import { cn } from "@/lib/utils"

interface EntityItem {
  type: string
  plural: string
  iconName: string
}

export function EntityMenu() {
  const [open, setOpen] = useState(false)
  const [entityItems, setEntityItems] = useState<EntityItem[]>([])
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    fetch("/api/spec")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.entities) setEntityItems(data.entities)
      })
      .catch(() => {})
  }, [])

  function show() {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }

  function hide() {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn("size-9", open && "bg-muted")}
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <Menu className="size-4" />
      </Button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-md py-1 min-w-[160px]">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/70 transition-colors"
          >
            <MessageSquare className="size-4 text-muted-foreground shrink-0" />
            Chat
          </Link>
          <div className="my-1 border-t" />
          <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Entities</p>
          {entityItems.map(entity => {
            const Icon = getIcon(entity.iconName)
            return (
              <Link
                key={entity.type}
                href={`/e/${entity.type.toLowerCase()}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/70 transition-colors"
              >
                <Icon className="size-4 text-muted-foreground shrink-0" />
                {entity.plural}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
