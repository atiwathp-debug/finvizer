import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface DataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Right-align numeric/amount columns. */
  align?: 'left' | 'right'
  /** Hide on the desktop table (still shown in the mobile card). */
  hideOnDesktop?: boolean
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  /** First column's value is used as the mobile card's title. */
  onRowClick?: (row: T) => void
}

export function DataTable<T>({ columns, rows, getRowKey, onRowClick }: DataTableProps<T>) {
  const visibleColumns = columns.filter((c) => !c.hideOnDesktop)
  const [titleColumn, ...restColumns] = columns

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      {/* Desktop / tablet: real table */}
      <table className="hidden w-full text-left text-sm sm:table">
        <thead className="border-b border-line bg-surface/60">
          <tr>
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 font-medium text-ink-muted',
                  col.align === 'right' && 'text-right',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && 'cursor-pointer hover:bg-surface/60')}
            >
              {visibleColumns.map((col) => (
                <td
                  key={col.key}
                  className={cn('px-4 py-3 text-ink', col.align === 'right' && 'text-right')}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: stacked cards */}
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((row) => (
          <li
            key={getRowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('p-4', onRowClick && 'cursor-pointer active:bg-surface/60')}
          >
            <div className="font-medium text-ink">{titleColumn.render(row)}</div>
            <dl className="mt-2 space-y-1">
              {restColumns.map((col) => (
                <div key={col.key} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-ink-muted">{col.header}</dt>
                  <dd className="text-ink">{col.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  )
}
