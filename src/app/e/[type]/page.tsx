import { notFound } from "next/navigation"
import { getEntity } from "@/entities/registry"
import { EntityListPage } from "@/components/entity/EntityListPage"
import { AppShell } from "@/components/layout/AppShell"

export default async function EntityPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const entity = getEntity(type)
  if (!entity) notFound()

  let initialItems: Record<string, unknown>[] = []
  try { initialItems = await entity.list() } catch { /* show empty */ }

  return (
    <AppShell>
      <EntityListPage
        type={entity.type.toLowerCase()}
        label={entity.label}
        plural={entity.plural}
        fields={entity.fields}
        initialItems={initialItems}
      />
    </AppShell>
  )
}
