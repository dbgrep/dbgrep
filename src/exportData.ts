import type { QueryResult } from './types'

export type ExportFormat = 'csv' | 'json'

function serializeValue(value: unknown): unknown {
  if (value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) return value
  return value
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function queryResultToCsv(result: QueryResult): string {
  const header = result.columns.map(csvCell).join(',')
  const lines = result.rows.map((row) =>
    result.columns.map((col) => csvCell(row[col])).join(',')
  )
  return [header, ...lines].join('\n')
}

export function queryResultToJson(result: QueryResult): string {
  const rows = result.rows.map((row) => {
    const record: Record<string, unknown> = {}
    for (const col of result.columns) {
      record[col] = serializeValue(row[col])
    }
    return record
  })
  return JSON.stringify(rows, null, 2)
}

export function serializeExport(result: QueryResult, format: ExportFormat): string {
  return format === 'csv' ? queryResultToCsv(result) : queryResultToJson(result)
}

export function sanitizeExportFilename(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '')
  return (cleaned || 'export').slice(0, 80)
}

export function defaultExportFilename(base: string, format: ExportFormat): string {
  return `${sanitizeExportFilename(base)}.${format}`
}
