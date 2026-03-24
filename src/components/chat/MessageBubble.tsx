"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Brain } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)}>
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-current opacity-50 animate-bounce"
          style={{ animationDuration: "900ms", animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  thinking?: string
  toolsUsed?: string[]
  toolResults?: Record<string, string>
  isStreaming?: boolean
  isThinking?: boolean
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      <Avatar className="size-9 shrink-0 mt-0.5">
        <AvatarFallback className="text-sm font-medium">
          {isUser ? "Me" : "E"}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex flex-col gap-2 max-w-[80%]", isUser && "items-end")}>
        {/* Thinking block — only shown for assistant */}
        {!isUser && (message.thinking || message.isThinking) && (
          <div className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground bg-muted/40 w-full">
            <div className="flex items-center gap-1.5 mb-1 font-medium text-xs uppercase tracking-wide text-muted-foreground">
              <Brain className="size-3.5" />
              Thinking
              {message.isThinking && <TypingDots className="ml-1" />}
            </div>
            {message.thinking && <p className="whitespace-pre-wrap leading-relaxed">{message.thinking}</p>}
          </div>
        )}

        {/* Main message bubble */}
        {(message.content || message.isStreaming) && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-base leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap"
                : "bg-muted rounded-tl-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none",
            )}
          >
            {message.isStreaming && !message.content
              ? <TypingDots />
              : isUser
                ? message.content
                : <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            }
          </div>
        )}

        {/* Tool badges — click to see result */}
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.toolsUsed.map(tool => {
              const result = message.toolResults?.[tool]
              if (!result) {
                return (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground animate-pulse"
                  >
                    <span className="size-1.5 rounded-full bg-current opacity-60" />
                    {tool.replace(/_/g, " ")}
                  </span>
                )
              }
              return (
                <Popover key={tool}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:bg-muted/60 transition-colors"
                      />
                    }
                  >
                    {tool.replace(/_/g, " ")}
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-80 max-h-64 overflow-y-auto">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{tool.replace(/_/g, " ")} result</p>
                    <pre className="text-xs whitespace-pre-wrap break-words font-mono leading-relaxed">{
                      (() => { try { return JSON.stringify(JSON.parse(result), null, 2) } catch { return result } })()
                    }</pre>
                  </PopoverContent>
                </Popover>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
