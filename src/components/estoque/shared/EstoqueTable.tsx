import { cn } from '@/lib/utils'
import { tbl } from './tableStyles'

export interface EstoqueTableColumn<T> {
  key: string
  header: React.ReactNode
  align?: 'left' | 'right' | 'center'
  cell: (row: T, index: number) => React.ReactNode
  className?: string
}

export interface EstoqueTableProps<T> {
  columns: EstoqueTableColumn<T>[]
  data: T[]
  keyExtractor: (row: T, index: number) => string
  isLoading?: boolean
  emptyMessage?: React.ReactNode
  footerLeft?: React.ReactNode
  footerRight?: React.ReactNode
}

export default function EstoqueTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage,
  footerLeft,
  footerRight,
}: EstoqueTableProps<T>) {
  const colCount = columns.length

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={tbl.theadRow}>
              {columns.map((col, ci) => (
                <th
                  key={col.key}
                  className={cn(
                    tbl.th,
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    ci === colCount - 1 && 'border-r-0',
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <tr key={i} className={tbl.tbodyRow}>
                  {columns.map((col, ci) => (
                    <td
                      key={col.key}
                      className={cn(tbl.td, ci === colCount - 1 && 'border-r-0')}
                    >
                      <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage ?? 'Nenhum registro encontrado.'}
                </td>
              </tr>
            ) : (
              data.map((row, ri) => (
                <tr key={keyExtractor(row, ri)} className={tbl.tbodyRow}>
                  {columns.map((col, ci) => (
                    <td
                      key={col.key}
                      className={cn(
                        tbl.td,
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        ci === colCount - 1 && 'border-r-0',
                        col.className,
                      )}
                    >
                      {col.cell(row, ri)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(footerLeft != null || footerRight != null) && (
        <div className={cn(tbl.tfootRow, 'flex items-center justify-between px-4 py-2')}>
          <span className={tbl.tfootCell}>{footerLeft}</span>
          <span className={tbl.tfootCell}>{footerRight}</span>
        </div>
      )}
    </>
  )
}
