import type { ConnectionRuntime, SavedConnection } from './types'
import { CLIENT_LABELS } from './types'

function haystack(conn: SavedConnection): string {
  const parts = [
    conn.name,
    conn.alias,
    ...(conn.tags ?? []),
    conn.config.host,
    conn.config.database,
    conn.config.filename,
    conn.config.user,
    CLIENT_LABELS[conn.config.client],
  ]
  return parts.filter(Boolean).join(' ').toLowerCase()
}

export function connectionMatchesQuery(
  conn: SavedConnection,
  query: string,
  runtime?: ConnectionRuntime
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  if (haystack(conn).includes(q)) return true

  if (runtime?.connected) {
    for (const schema of runtime.schemas) {
      if (schema.name.toLowerCase().includes(q)) return true
      if (schema.tables.some((t) => t.toLowerCase().includes(q))) return true
    }
  }

  return false
}

export function schemaMatchesQuery(schemaName: string, tables: string[], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (schemaName.toLowerCase().includes(q)) return true
  return tables.some((t) => t.toLowerCase().includes(q))
}

export function tableMatchesQuery(table: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return table.toLowerCase().includes(q)
}

export function parseTagsInput(raw: string): string[] {
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))]
}
