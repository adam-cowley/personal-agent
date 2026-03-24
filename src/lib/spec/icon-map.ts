/**
 * Client-safe map from icon name string (used in YAML) to Lucide React component.
 * Add new entries here when using new icons in graph.yaml.
 */

import {
  Box,
  Users,
  FolderKanban,
  CheckSquare,
  Briefcase,
  Building,
  Calendar,
  FileText,
  Globe,
  Hash,
  Layers,
  Star,
  Tag,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const ICON_MAP: Record<string, LucideIcon> = {
  Box,
  Users,
  FolderKanban,
  CheckSquare,
  Briefcase,
  Building,
  Calendar,
  FileText,
  Globe,
  Hash,
  Layers,
  Star,
  Tag,
  Zap,
}

export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Box
}
