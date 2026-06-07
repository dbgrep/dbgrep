import { useEffect } from 'react'
import { useColumnSort } from '../hooks/useColumnSort'
import type { SortDirection } from '../sortData'
import './SortableResultTable.css'

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function sortIndicator(column: string, sortColumn: string | null, direction: SortDirection): string {
  if (sortColumn !== column) return '↕'
  return direction === 'asc' ? '↑' : '↓'
}

interface Props {
  columns: string[]
  rows: Record<string, unknown>[]
  emptyMessage?: string
  resetKey?: string
}

export default function SortableResultTable({
  columns,
  rows,
  emptyMessage = 'No rows',
  resetKey,
}: Props) {
  const { sortColumn, sortDirection, toggleSort, applySort, resetSort } = useColumnSort()

  useEffect(() => {
    resetSort()
  }, [resetKey, resetSort])

  const sortedRows = applySort(rows)

  if (columns.length === 0) {
    return <div className="sortable-table-empty">No columns returned</div>
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>
                <button
                  type="button"
                  className={`sortable-col-header${sortColumn === col ? ' sorted' : ''}`}
                  onClick={() => toggleSort(col)}
                  aria-sort={
                    sortColumn === col
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span className="sortable-col-name">{col}</span>
                  <span className="sortable-col-indicator" aria-hidden="true">
                    {sortIndicator(col, sortColumn, sortDirection)}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="no-rows-cell">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => {
                  const val = row[col]
                  const isNull = val === null || val === undefined
                  return (
                    <td key={col} className={isNull ? 'null-cell' : ''}>
                      {formatCell(val)}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
