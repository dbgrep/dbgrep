import type { Monaco } from '@monaco-editor/react'
import type { languages, IPosition, editor } from 'monaco-editor'
import type { AutocompleteCatalog } from './types'

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
  'ON', 'AS', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE TABLE',
  'ALTER TABLE', 'DROP TABLE', 'TRUNCATE', 'DISTINCT', 'COUNT', 'SUM',
  'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'IS NULL', 'IS NOT NULL', 'EXISTS', 'UNION', 'UNION ALL',
  'WITH', 'ASC', 'DESC', 'NULL', 'TRUE', 'FALSE',
  'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'DEFAULT',
  'SHOW', 'DESCRIBE', 'EXPLAIN', 'PRAGMA',
]

export interface AutocompleteContext {
  catalog: AutocompleteCatalog
  getColumns: (schema: string, table: string) => Promise<string[]>
}

function tablesFromCatalog(catalog: AutocompleteCatalog): { schema: string; table: string }[] {
  const out: { schema: string; table: string }[] = []
  for (const schema of catalog.schemas) {
    for (const table of schema.tables) {
      out.push({ schema: schema.name, table })
    }
  }
  return out
}

function wordBeforeCursor(text: string, offset: number): string {
  const before = text.slice(0, offset)
  const match = before.match(/[\w.]+$/)
  return match ? match[0] : ''
}

function findSchema(catalog: AutocompleteCatalog, name: string) {
  const lower = name.toLowerCase()
  return (
    catalog.schemas.find((s) => s.name.toLowerCase() === lower) ??
    catalog.schemas.find((s) => s.name.toLowerCase().startsWith(lower))
  )
}

function completionRange(
  position: IPosition,
  word: string
): { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number } {
  // After "schema." the insert point is the cursor — don't replace the schema prefix
  if (word.endsWith('.')) {
    return {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: position.column,
      endColumn: position.column,
    }
  }

  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: Math.max(1, position.column - word.length),
    endColumn: position.column,
  }
}

function tablesReferencedBeforeCursor(text: string, offset: number): { schema: string; table: string }[] {
  const before = text.slice(0, offset)
  const refs: { schema: string; table: string }[] = []
  const pattern = /(?:FROM|JOIN)\s+([\w.]+)/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(before)) !== null) {
    const ref = match[1]
    if (ref.includes('.')) {
      const [schema, table] = ref.split('.')
      refs.push({ schema, table })
    } else {
      refs.push({ schema: '', table: ref })
    }
  }
  return refs
}

function resolveTableRef(
  ref: { schema: string; table: string },
  catalog: AutocompleteCatalog
): { schema: string; table: string } | null {
  if (ref.schema) {
    const schema = findSchema(catalog, ref.schema)
    const table = schema?.tables.find((t) => t.toLowerCase() === ref.table.toLowerCase())
    if (schema && table) return { schema: schema.name, table }
    return null
  }
  for (const schema of catalog.schemas) {
    const table = schema.tables.find((t) => t.toLowerCase() === ref.table.toLowerCase())
    if (table) {
      return { schema: schema.name, table }
    }
  }
  return null
}

let providerDisposable: { dispose: () => void } | null = null

export function registerSqlAutocomplete(
  monaco: Monaco,
  getContext: () => AutocompleteContext
): () => void {
  providerDisposable?.dispose()

  const provider = monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' ', '\n'],
    provideCompletionItems: async (model: editor.ITextModel, position: IPosition) => {
      const ctx = getContext()
      const text = model.getValue()
      const offset = model.getOffsetAt(position)
      const word = wordBeforeCursor(text, offset)
      const range = completionRange(position, word)

      const suggestions: languages.CompletionItem[] = []
      const kind = monaco.languages.CompletionItemKind

      const allTables = tablesFromCatalog(ctx.catalog)

      if (word.endsWith('.')) {
        const prefix = word.slice(0, -1)
        const parts = prefix.split('.')

        if (parts.length === 1) {
          const schemaName = parts[0]
          const schema = findSchema(ctx.catalog, schemaName)
          if (schema) {
            for (const table of schema.tables) {
              suggestions.push({
                label: table,
                kind: kind.Class,
                insertText: table,
                range,
                detail: `${schema.name}.${table}`,
              })
            }
          }
          return { suggestions }
        }

        if (parts.length === 2) {
          const [schemaName, tableName] = parts
          const schema = findSchema(ctx.catalog, schemaName)
          const resolvedTable = schema?.tables.find(
            (t) => t.toLowerCase() === tableName.toLowerCase()
          )
          if (schema && resolvedTable) {
            const columns = await ctx.getColumns(schema.name, resolvedTable)
            for (const col of columns) {
              suggestions.push({
                label: col,
                kind: kind.Field,
                insertText: col,
                range,
                detail: `${schema.name}.${resolvedTable}`,
              })
            }
          }
          return { suggestions }
        }
      }

      const dotParts = word.split('.')
      if (dotParts.length === 2 && dotParts[1].length > 0) {
        const [schemaName, tablePrefix] = dotParts
        const schema = findSchema(ctx.catalog, schemaName)
        if (schema) {
          const exactTable = schema.tables.find(
            (t) => t.toLowerCase() === tablePrefix.toLowerCase()
          )
          if (exactTable) {
            const columns = await ctx.getColumns(schema.name, exactTable)
            for (const col of columns) {
              suggestions.push({
                label: col,
                kind: kind.Field,
                insertText: col,
                range,
                detail: `${schema.name}.${exactTable}`,
              })
            }
            return { suggestions }
          }

          for (const table of schema.tables) {
            if (table.toLowerCase().startsWith(tablePrefix.toLowerCase())) {
              suggestions.push({
                label: table,
                kind: kind.Class,
                insertText: table,
                range,
                detail: `${schema.name}.${table}`,
              })
            }
          }
          return { suggestions }
        }
      }

      const tableRefs = tablesReferencedBeforeCursor(text, offset)
      const columnPromises = tableRefs.map(async (ref) => {
        const resolved = resolveTableRef(ref, ctx.catalog)
        if (!resolved) return []
        return ctx.getColumns(resolved.schema, resolved.table)
      })
      const columnSets = await Promise.all(columnPromises)
      const seenColumns = new Set<string>()
      for (const cols of columnSets) {
        for (const col of cols) {
          if (seenColumns.has(col)) continue
          seenColumns.add(col)
          if (!word || col.toLowerCase().startsWith(word.toLowerCase())) {
            suggestions.push({
              label: col,
              kind: kind.Field,
              insertText: col,
              range,
            })
          }
        }
      }

      for (const kw of SQL_KEYWORDS) {
        if (!word || kw.toLowerCase().startsWith(word.toLowerCase())) {
          suggestions.push({
            label: kw,
            kind: kind.Keyword,
            insertText: kw,
            range,
          })
        }
      }

      for (const schema of ctx.catalog.schemas) {
        if (!word || schema.name.toLowerCase().startsWith(word.toLowerCase())) {
          suggestions.push({
            label: schema.name,
            kind: kind.Module,
            insertText: schema.name,
            range,
            detail: 'schema',
          })
        }
      }

      for (const { schema, table } of allTables) {
        const label = schema ? `${schema}.${table}` : table
        const insertText = schema ? `${schema}.${table}` : table
        if (!word || label.toLowerCase().includes(word.toLowerCase())) {
          suggestions.push({
            label: table,
            kind: kind.Class,
            insertText,
            range,
            detail: schema || 'table',
          })
        }
      }

      return { suggestions }
    },
  })

  providerDisposable = provider
  return () => provider.dispose()
}
