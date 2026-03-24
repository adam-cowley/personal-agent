"use client"

import { useState, useEffect, useCallback } from "react"
import { History, Search, MessageSquare, X, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface ChatSummary {
  id: string
  title: string
  modeId: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

interface SearchResult {
  chatId: string
  chatTitle: string
  messageId: string
  role: string
  content: string
  score: number
  createdAt: string
}

interface ChatHistoryProps {
  currentChatId: string
  onLoadChat(chatId: string, messages: Array<{ role: "user" | "assistant"; content: string; id: string }>): void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function ChatHistory({ currentChatId, onLoadChat }: ChatHistoryProps) {
  const [open, setOpen] = useState(false)
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const fetchChats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/chats")
      if (res.ok) setChats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchChats()
  }, [open, fetchChats])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/chats/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) setSearchResults(await res.json())
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  async function handleLoadChat(chatId: string) {
    try {
      const res = await fetch(`/api/chats/${chatId}`)
      if (!res.ok) return
      const msgs: Array<{ id: string; role: "user" | "assistant"; content: string }> = await res.json()
      onLoadChat(chatId, msgs)
      setOpen(false)
    } catch { /* ignore */ }
  }

  const MODE_LABELS: Record<string, string> = {
    default: "Elsie",
    "steve-jobs": "Steve Jobs",
    socratic: "Socratic",
    "devils-advocate": "Devil's Advocate",
    "mbti-coach": "MBTI Coach",
    board: "Board",
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Chat history"
          />
        }
      >
        <History className="size-4" />
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[75vh] flex flex-col p-0">
        <SheetHeader className="border-b px-4 py-3 shrink-0">
          <SheetTitle className="text-sm">Conversation history</SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 py-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-muted/50 rounded-md border-0 outline-none ring-1 ring-transparent focus:ring-ring placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Search results */}
          {searchQuery && (
            <>
              {searchLoading && (
                <p className="px-4 py-3 text-sm text-muted-foreground animate-pulse">Searching…</p>
              )}
              {!searchLoading && searchResults?.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">No results found.</p>
              )}
              {!searchLoading && searchResults && searchResults.length > 0 && searchResults.map(r => (
                <button
                  key={r.messageId}
                  type="button"
                  onClick={() => handleLoadChat(r.chatId)}
                  className="w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquare className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground truncate">{r.chatTitle}</span>
                  </div>
                  <p className="text-sm line-clamp-2 text-foreground">{r.content}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="size-3" />
                    {timeAgo(r.createdAt)}
                    {r.role === "assistant" && <span className="ml-1 text-primary">· Elsie</span>}
                  </p>
                </button>
              ))}
            </>
          )}

          {/* Chat list */}
          {!searchQuery && (
            <>
              {loading && (
                <p className="px-4 py-3 text-sm text-muted-foreground animate-pulse">Loading…</p>
              )}
              {!loading && chats.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No past conversations yet.
                  <br />
                  <span className="text-xs">They'll appear here after your first chat.</span>
                </p>
              )}
              {chats.map(chat => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => handleLoadChat(chat.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors",
                    chat.id === currentChatId && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "text-sm font-medium truncate flex-1",
                      chat.id === currentChatId && "text-primary"
                    )}>
                      {chat.title}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(chat.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {chat.modeId !== "default" && (
                      <span className="text-xs text-primary">{MODE_LABELS[chat.modeId] ?? chat.modeId}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {chat.messageCount} {chat.messageCount === 1 ? "message" : "messages"}
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
