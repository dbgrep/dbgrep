export type TableFilterOperator =
  | 'is_empty'
  | 'is_not_empty'
  | 'is_null'
  | 'is_not_null'
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'

export interface TableFilter {
  id: string
  column: string
  operator: TableFilterOperator
  value?: string
}

export const TABLE_FILTER_OPERATORS: {
  value: TableFilterOperator
  label: string
  needsValue: boolean
}[] = [
  { value: 'is_empty', label: 'Is empty', needsValue: false },
  { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  { value: 'is_null', label: 'Is null', needsValue: false },
  { value: 'is_not_null', label: 'Exists', needsValue: false },
  { value: 'equals', label: 'Equals', needsValue: true },
  { value: 'not_equals', label: 'Not equals', needsValue: true },
  { value: 'contains', label: 'Contains', needsValue: true },
  { value: 'not_contains', label: 'Does not contain', needsValue: true },
  { value: 'starts_with', label: 'Starts with', needsValue: true },
  { value: 'ends_with', label: 'Ends with', needsValue: true },
]

export function filterNeedsValue(operator: TableFilterOperator): boolean {
  return TABLE_FILTER_OPERATORS.find((o) => o.value === operator)?.needsValue ?? true
}

export function filterOperatorLabel(operator: TableFilterOperator): string {
  return TABLE_FILTER_OPERATORS.find((o) => o.value === operator)?.label ?? operator
}

export function isCompleteFilter(filter: TableFilter): boolean {
  if (!filter.column) return false
  if (filterNeedsValue(filter.operator)) {
    return (filter.value ?? '').trim().length > 0
  }
  return true
}

export function getActiveFilters(filters: TableFilter[]): TableFilter[] {
  return filters.filter(isCompleteFilter)
}

export function formatFilterSummary(filter: TableFilter): string {
  const op = filterOperatorLabel(filter.operator)
  if (filterNeedsValue(filter.operator)) {
    return `${filter.column} ${op.toLowerCase()} "${filter.value ?? ''}"`
  }
  return `${filter.column} ${op.toLowerCase()}`
}

export function sameTableFilters(a: TableFilter[], b: TableFilter[]): boolean {
  const activeA = getActiveFilters(a)
  const activeB = getActiveFilters(b)
  if (activeA.length !== activeB.length) return false
  return activeA.every(
    (filter, index) =>
      filter.column === activeB[index].column &&
      filter.operator === activeB[index].operator &&
      (filter.value ?? '') === (activeB[index].value ?? '')
  )
}
