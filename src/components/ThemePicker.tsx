"use client"

import { useState } from "react"
import { THEMES, getTheme, setTheme, type ThemeId } from "@/lib/theme"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemePicker() {
  const [current, setCurrent] = useState<ThemeId>(() =>
    typeof window !== "undefined" ? getTheme() : "default"
  )

  function pick(id: ThemeId) {
    setTheme(id)
    setCurrent(id)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {THEMES.map(theme => (
        <button
          key={theme.id}
          onClick={() => pick(theme.id)}
          title={theme.label}
          className={cn(
            "size-8 rounded-full border-2 flex items-center justify-center transition-all",
            current === theme.id ? "border-foreground scale-110" : "border-border hover:scale-105"
          )}
          style={{ backgroundColor: theme.color }}
        >
          {current === theme.id && <Check className="size-4 text-white drop-shadow" />}
        </button>
      ))}
    </div>
  )
}
