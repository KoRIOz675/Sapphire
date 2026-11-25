import { ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  /** Value used for free-text search filtering */
  searchValue?: (row: T) => string;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  /** Additional filters to display above the table */
  filters?: ReactNode;
  /** What to render when rows is empty */
  emptyState?: ReactNode;
  /** Optional row click handler (e.g., navigate to detail) */
  onRowClick?: (row: T) => void;
  /** Right-aligned actions column renderer */
  actions?: (row: T) => ReactNode;
  /** Controlled sort state (optional — falls back to internal state) */
  sortKey?: string | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
  /** Number of rows per page (default 25) */
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 25;

export default function DataTable<T extends { id: string }>({
  rows,
  columns,
  filters,
  emptyState,
  onRowClick,
  actions,
  sortKey: externalSortKey,
  sortDir: externalSortDir,
  onSortChange,
  pageSize = DEFAULT_PAGE_SIZE,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Internal sort state used only when no external control is provided
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<"asc" | "desc">("asc");

  const isControlled = externalSortKey !== undefined;
  const sortKey = isControlled ? externalSortKey : internalSortKey;
  const sortDir = isControlled ? (externalSortDir ?? "asc") : internalSortDir;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((col) => {
        const v = col.searchValue
          ? col.searchValue(row)
          : String(col.accessor(row) ?? "");
        return v.toLowerCase().includes(q);
      }),
    );
  }, [rows, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, columns]);

  // Pagination — reset to page 1 when filter/sort/search changes
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: string) {
    // Reset to page 1 on sort change
    setPage(1);
    const newDir =
      sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    if (isControlled) {
      onSortChange?.(key, newDir);
    } else {
      setInternalSortKey(key);
      setInternalSortDir(newDir);
    }
  }

  function handleQueryChange(q: string) {
    setQuery(q);
    setPage(1);
  }

  // Page number buttons — show at most 5 around current page
  const pageButtons = useMemo(() => {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("…");
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
        pages.push(i);
      }
      if (safePage < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  return (
    <div className="space-y-3">
      {/* Search + filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-8"
            placeholder={t("common.search")}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
        </div>
        {filters}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2 text-left font-medium text-slate-600 ${col.className ?? ""}`}
                >
                  {col.sortValue ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.header}
                      {sortKey === col.key && (
                        <span className="text-xs">
                          {sortDir === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {actions && (
                <th className="px-4 py-2 text-right font-medium text-slate-600">
                  {t("common.actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {emptyState ?? t("common.empty")}
                </td>
              </tr>
            )}
            {paginated.map((row) => (
              <tr
                key={row.id}
                className={`hover:bg-slate-50 ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 align-top ${col.className ?? ""}`}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
                {actions && (
                  <td
                    className="whitespace-nowrap px-4 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination bar — only shown when there's more than one page */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
          <span className="text-xs text-slate-400">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}{" "}
            / {sorted.length}
          </span>

          <div className="flex items-center gap-1">
            <button
              className="btn-secondary px-2 py-1 disabled:opacity-40"
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {pageButtons.map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} className="px-1 text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  className={`min-w-8 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    p === safePage
                      ? "bg-sapphire-600 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              className="btn-secondary px-2 py-1 disabled:opacity-40"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
