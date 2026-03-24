"use client"

import { useState, useEffect } from "react"
import { Wand2, Check, ChevronRight, ArrowLeft, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { MbtiPicker } from "@/components/MbtiPicker"
import type { Persona } from "@/modes/types"

const CATEGORY_LABELS: Record<string, string> = {
  default: "Assistant",
  persona: "Personas",
  coach: "Coaching",
  panel: "Panels",
}

interface PersonaSelectorProps {
  personas: Persona[]
  selectedPersonaId: string
  selectedGroupIds: string[]
  isGroupMode: boolean
  onSelect(personaId: string, context?: Record<string, unknown>): void
  onGroupSelect(personaIds: string[]): void
}

export function PersonaSelector({
  personas,
  selectedPersonaId,
  selectedGroupIds,
  isGroupMode,
  onSelect,
  onGroupSelect,
}: PersonaSelectorProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"single" | "group">("single")
  const [step, setStep] = useState<"list" | "mbti">("list")
  const [pendingPersona, setPendingPersona] = useState<Persona | null>(null)
  const [mbtiValue, setMbtiValue] = useState("")
  const [groupPicked, setGroupPicked] = useState<string[]>(selectedGroupIds)

  // Reset group picks when opening
  useEffect(() => {
    if (open) setGroupPicked(selectedGroupIds)
  }, [open, selectedGroupIds])

  const activePersona = personas.find(p => p.id === selectedPersonaId)
  const displayLabel = isGroupMode
    ? `Group (${selectedGroupIds.length})`
    : (activePersona?.name ?? "Select persona")

  function handlePersonaClick(persona: Persona) {
    if (persona.requiresMbtiTarget) {
      setPendingPersona(persona)
      setMbtiValue("")
      setStep("mbti")
    } else {
      onSelect(persona.id)
      setOpen(false)
    }
  }

  function confirmMbti() {
    if (pendingPersona) {
      onSelect(pendingPersona.id, { targetMbti: mbtiValue })
      setOpen(false)
    }
  }

  function confirmGroup() {
    if (groupPicked.length >= 2) {
      onGroupSelect(groupPicked)
      setOpen(false)
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) { setStep("list"); setTab("single") }
  }

  const grouped = Object.entries(
    personas.reduce<Record<string, Persona[]>>((acc, p) => {
      const cat = p.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(p)
      return acc
    }, {})
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-1.5 h-7 px-2 text-xs font-medium", (selectedPersonaId !== "elsie" || isGroupMode) && "text-primary")}
            aria-label="Select persona"
          />
        }
      >
        <Wand2 className="size-3.5" />
        {displayLabel}
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[70vh] flex flex-col p-0">
        {step === "list" && (
          <>
            <SheetHeader className="border-b px-4 py-3 shrink-0">
              <SheetTitle className="text-sm">Choose who to talk to</SheetTitle>
              {/* Tab strip */}
              <div className="flex gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => setTab("single")}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                    tab === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  One-on-one
                </button>
                <button
                  type="button"
                  onClick={() => setTab("group")}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                    tab === "group" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  Group conversation
                </button>
              </div>
            </SheetHeader>

            {tab === "single" && (
              <div className="flex-1 overflow-y-auto">
                {grouped.map(([cat, catPersonas]) => (
                  <div key={cat}>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </p>
                    {catPersonas.map(persona => {
                      const isActive = !isGroupMode && persona.id === selectedPersonaId
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => handlePersonaClick(persona)}
                          className={cn(
                            "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                            isActive && "bg-primary/5"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn("text-sm font-medium", isActive && "text-primary")}>{persona.name}</p>
                              {(persona.mbti || persona.enneagram) && (
                                <span className="text-xs text-muted-foreground">
                                  {[persona.mbti, persona.enneagram].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{persona.description}</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">{persona.provider} · {persona.model}</p>
                          </div>
                          {persona.requiresMbtiTarget
                            ? <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                            : isActive
                              ? <Check className="size-4 text-primary shrink-0 mt-0.5" />
                              : null
                          }
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {tab === "group" && (
              <>
                <div className="flex-1 overflow-y-auto">
                  <p className="px-4 pt-3 pb-1 text-xs text-muted-foreground">
                    Select 2+ personas — each will respond in turn using their own AI.
                  </p>
                  {personas.map(persona => {
                    const checked = groupPicked.includes(persona.id)
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => setGroupPicked(prev =>
                          checked ? prev.filter(id => id !== persona.id) : [...prev, persona.id]
                        )}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                          checked && "bg-primary/5"
                        )}
                      >
                        <div className={cn(
                          "size-4 rounded border shrink-0 flex items-center justify-center",
                          checked ? "bg-primary border-primary" : "border-muted-foreground/40"
                        )}>
                          {checked && <Check className="size-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{persona.name}</p>
                          <p className="text-xs text-muted-foreground">{persona.description}</p>
                          <p className="text-xs text-muted-foreground/60">{persona.provider} · {persona.model}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="border-t px-4 py-3 shrink-0">
                  <Button
                    className="w-full"
                    disabled={groupPicked.length < 2}
                    onClick={confirmGroup}
                  >
                    {groupPicked.length < 2
                      ? "Select at least 2 personas"
                      : `Start group conversation (${groupPicked.length})`
                    }
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {step === "mbti" && pendingPersona && (
          <>
            <SheetHeader className="border-b px-4 py-3 shrink-0 flex-row items-center gap-2">
              <button type="button" onClick={() => setStep("list")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
              </button>
              <SheetTitle className="text-sm">Who are you communicating with?</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="text-xs text-muted-foreground mb-4">
                Answer four questions to identify their Myers-Briggs type. The coach will tailor advice accordingly.
              </p>
              <MbtiPicker value={mbtiValue} onChange={setMbtiValue} />
            </div>
            <div className="border-t px-4 py-3 shrink-0">
              <Button className="w-full" disabled={mbtiValue.length < 4} onClick={confirmMbti}>
                {mbtiValue.length < 4 ? "Answer all four questions" : `Start coaching for ${mbtiValue}`}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
