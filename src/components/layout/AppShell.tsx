"use client"

import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MessageSquare, FileText, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { EntityMenu } from "@/components/entity/EntityMenu"
import { useConfig } from "@/components/ConfigProvider"

const nav = [
  { href: "/", icon: MessageSquare, label: "Chat" },
  { href: "/digest", icon: FileText, label: "Digest" },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { config } = useConfig()

  return (
    <div className="flex h-full w-full max-w-xl mx-auto flex-col border-x">
      {/* Top nav */}
      <header className="flex h-14 items-center gap-1 border-b px-3 shrink-0">
        <EntityMenu />
        <Link href="/" className="font-semibold text-base px-2 tracking-tight hover:opacity-70 transition-opacity">
          {config.name}
        </Link>
        <div className="flex-1" />
        {nav.map(({ href, icon: Icon, label }) => (
          <Tooltip key={href}>
            <TooltipTrigger
              render={
                <Link
                  href={href}
                  aria-label={label}
                  className={cn(
                    buttonVariants({ variant: pathname === href ? "secondary" : "ghost", size: "icon" }),
                    "size-10"
                  )}
                />
              }
            >
              <Icon className="size-5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/settings"
                aria-label="Settings"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-10")}
              />
            }
          >
            <Settings className="size-5" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
