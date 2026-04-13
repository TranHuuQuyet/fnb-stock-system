import { ReactNode } from 'react';

export function SimpleTable({
  columns,
  rows,
  emptyMessage = 'Chưa có dữ liệu.'
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50 px-4 py-6 text-sm text-slate-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => {
          const [primaryCell, ...detailCells] = row;

          return (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm"
            >
              <div className="border-b border-brand-100 bg-brand-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {columns[0] ?? 'Mục'}
                </p>
                <div className="mt-1 text-sm font-semibold text-brand-900">{primaryCell}</div>
              </div>

              <div className="divide-y divide-brand-100">
                {detailCells.map((cell, detailIndex) => {
                  const columnIndex = detailIndex + 1;

                  return (
                    <div
                      key={columnIndex}
                      className="grid grid-cols-[112px,minmax(0,1fr)] gap-3 px-4 py-3"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {columns[columnIndex] ?? `Cột ${columnIndex + 1}`}
                      </div>
                      <div className="min-w-0 text-sm text-slate-700">{cell}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {columns.map((column) => (
                <th key={column} className="px-3 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-slate-100 align-top">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-3 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
