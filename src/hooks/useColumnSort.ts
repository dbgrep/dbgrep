import { useCallback, useState } from 'react'
import { sortRows, type SortDirection } from '../sortData'

interface SortState {
  column: string | null
  direction: SortDirection
}

export function useColumnSort() {
  const [sort, setSort] = useState<SortState>({ column: null, direction: 'asc' })

  const toggleSort = useCallback((column: string) => {
    setSort((prev) => {
      if (prev.column !== column) {
        return { column, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' }
      }
      return { column: null, direction: 'asc' }
    })
  }, [])

  const applySort = useCallback(
    (rows: Record<string, unknown>[]) => {
      if (!sort.column) return rows
      return sortRows(rows, sort.column, sort.direction)
    },
    [sort]
  )

  const resetSort = useCallback(() => {
    setSort({ column: null, direction: 'asc' })
  }, [])

  return {
    sortColumn: sort.column,
    sortDirection: sort.direction,
    toggleSort,
    applySort,
    resetSort,
  }
}
