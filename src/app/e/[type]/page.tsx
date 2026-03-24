import { notFound } from "next/navigation"
import { getEntity } from "@/entities/registry"
import { loadGraphSpec } from "@/lib/spec/loader"
import { EntityListPage } from "@/components/entity/EntityListPage"
import { AppShell } from "@/components/layout/AppShell"

export default async function EntityPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const entity = getEntity(type)
  if (!entity) notFound()

  const graphSpec = loadGraphSpec()
  const iconName = graphSpec.nodes[entity.type]?.extensions?.ui?._icon

  return (
    <AppShell>
      <EntityListPage
        type={entity.type.toLowerCase()}
        label={entity.label}
        plural={entity.plural}
        iconName={iconName}
      />
    </AppShell>
  )
}
