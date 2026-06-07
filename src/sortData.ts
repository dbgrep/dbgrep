export type SortDirection = 'asc' | 'desc'

function compareValues(a: unknown, b: unknown): number {
  const aNull = a === null || a === undefined
  const bNull = b === null || b === undefined
  if (aNull && bNull) return 0
  if (aNull) return 1
  if (bNull) return -1

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b)
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime()
  }

  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a).localeCompare(JSON.stringify(b))
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function sortRows(
  rows: Record<string, unknown>[],
  column: string,
  direction: SortDirection
): Record<string, unknown>[] {
  const sorted = [...rows].sort((left, right) => compareValues(left[column], right[column]))
  return direction === 'desc' ? sorted.reverse() : sorted
}
