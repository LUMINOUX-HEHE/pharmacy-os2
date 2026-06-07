import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { useMemo, useState } from "react";

import { cn } from "../lib/cn.js";

import { Button } from "./button.js";
import { EmptyState } from "./empty-state.js";


export const Table = ({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto">
    <table className={cn("w-full min-w-[760px] border-collapse text-left text-sm", className)} {...props} />
  </div>
);

export const Th = ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900", className)} {...props} />
);

export const Td = ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("border-b border-slate-100 px-3 py-3 text-slate-700 dark:border-slate-800 dark:text-slate-300", className)} {...props} />
);

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: keyof T;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  pageSize?: number;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const DataTable = <T,>({
  data,
  columns,
  getRowId,
  pageSize = 10,
  selectable = false,
  selectedIds,
  onSelectedIdsChange,
  emptyTitle = "No data",
  emptyDescription = "There are no rows to show."
}: DataTableProps<T>) => {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const controlledSelection = selectedIds ?? new Set<string>();
  const sorted = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((item) => item.id === sort.id);
    if (!column) return data;
    const valueFor = (row: T) => column.sortValue?.(row) ?? (column.accessor ? row[column.accessor] : "");
    return [...data].sort((a, b) => {
      const left = valueFor(a);
      const right = valueFor(b);
      const multiplier = sort.direction === "asc" ? 1 : -1;
      if (typeof left === "number" && typeof right === "number") return (left - right) * multiplier;
      return String(left).localeCompare(String(right)) * multiplier;
    });
  }, [columns, data, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const toggleSelection = (id: string) => {
    const next = new Set(controlledSelection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange?.(next);
  };

  return (
    <div className="space-y-3">
      <Table>
        <thead>
          <tr>
            {selectable ? <Th className="w-10" /> : null}
            {columns.map((column) => (
              <Th key={column.id} className={column.className}>
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => setSort((current) => ({ id: column.id, direction: current?.id === column.id && current.direction === "asc" ? "desc" : "asc" }))}
                    className="inline-flex items-center gap-1"
                  >
                    {column.header}{sort?.id === column.id ? (sort.direction === "asc" ? " ↑" : " ↓") : null}
                  </button>
                ) : column.header}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const id = getRowId(row);
            return (
              <tr key={id}>
                {selectable ? <Td><input type="checkbox" checked={controlledSelection.has(id)} onChange={() => toggleSelection(id)} /></Td> : null}
                {columns.map((column) => (
                  <Td key={column.id} className={column.className}>
                    {column.cell ? column.cell(row) : column.accessor ? String(row[column.accessor] ?? "") : null}
                  </Td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, sorted.length)} of {sorted.length}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
        </div>
      </div>
    </div>
  );
};
