"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EntityForm } from "./EntityForm"
import type { EntityDef } from "@/entities/types"

interface EntityDialogProps {
  entity: EntityDef
  initial?: Record<string, unknown>
  open: boolean
  onClose: () => void
  onSaved: (item: Record<string, unknown>) => void
}

export function EntityDialog({ entity, initial, open, onClose, onSaved }: EntityDialogProps) {
  const isEdit = !!(initial?.id)
  const title = isEdit ? `Edit ${entity.label}` : `New ${entity.label}`

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm w-full max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <EntityForm
            entity={entity}
            initial={initial}
            onSuccess={item => { onSaved(item); onClose() }}
            onCancel={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
