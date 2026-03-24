"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { entities } from "@/entities/registry"
import { cn } from "@/lib/utils"

export function EntityMenu() {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()

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
          {entities.map(entity => {
            const Icon = entity.icon
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
