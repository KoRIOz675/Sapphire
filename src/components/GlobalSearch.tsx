import { forwardRef, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Users, Building2, ListChecks, FolderKanban } from "lucide-react";
import clsx from "clsx";

import { useGlobalSearch } from "../hooks";
import type { SearchResult } from "../types";

function entityIcon(type: string) {
  switch (type) {
    case "person":  return <Users className="h-3.5 w-3.5 shrink-0" />;
    case "company": return <Building2 className="h-3.5 w-3.5 shrink-0" />;
    case "action":  return <ListChecks className="h-3.5 w-3.5 shrink-0" />;
    case "project": return <FolderKanban className="h-3.5 w-3.5 shrink-0" />;
    default:        return null;
  }
}

function entityRoute(r: SearchResult): string {
  switch (r.entityType) {
    case "person":  return `/people/${r.id}`;
    case "company": return `/company/${r.id}`;
    case "action":  return `/actions/${r.id}`;
    case "project": return `/projects/${r.id}`;
    default:        return "/";
  }
}

function entityColor(type: string): string {
  switch (type) {
    case "person":  return "text-sapphire-600";
    case "company": return "text-violet-600";
    case "action":  return "text-amber-600";
    case "project": return "text-emerald-600";
    default:        return "text-slate-500";
  }
}

function groupByType(results: SearchResult[]): [string, SearchResult[]][] {
  const order = ["person", "company", "action", "project"];
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!map.has(r.entityType)) map.set(r.entityType, []);
    map.get(r.entityType)!.push(r);
  }
  return order.filter((t) => map.has(t)).map((t) => [t, map.get(t)!]);
}

// Expose the internal input ref to parent (Layout) so useGlobalShortcuts can focus it
const GlobalSearch = forwardRef<HTMLInputElement>(function GlobalSearch(_props, ref) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results = [], isFetching } = useGlobalSearch(query);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Close on Escape (dispatched by useGlobalShortcuts)
  useEffect(() => {
    function handle() { setOpen(false); }
    document.addEventListener("sapphire:close-modal", handle);
    return () => document.removeEventListener("sapphire:close-modal", handle);
  }, []);

  useEffect(() => {
    setOpen(query.trim().length >= 2);
  }, [query]);

  function navigate(result: SearchResult) {
    nav(entityRoute(result));
    setQuery("");
    setOpen(false);
  }

  const grouped = groupByType(results);
  const typeLabel = (type: string) => {
    switch (type) {
      case "person":  return t("person.plural");
      case "company": return t("company.plural");
      case "action":  return t("action.plural");
      case "project": return t("project.plural");
      default:        return type;
    }
  };

  return (
    <div ref={containerRef} className="relative px-2 py-2">
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm focus-within:border-sapphire-400 focus-within:ring-1 focus-within:ring-sapphire-400">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.search") + "... (Ctrl+K)"}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-hidden"
        />
        {isFetching && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-sapphire-400 border-t-transparent shrink-0" />
        )}
      </div>

      {open && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.length === 0 && !isFetching ? (
            <p className="px-3 py-4 text-center text-sm text-slate-400">{t("common.empty")}</p>
          ) : (
            grouped.map(([type, items]) => (
              <div key={type}>
                <div className={clsx("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide", entityColor(type))}>
                  {entityIcon(type)}
                  {typeLabel(type)}
                </div>
                {items.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-sapphire-50 focus:bg-sapphire-50 focus:outline-hidden"
                    onClick={() => navigate(r)}
                  >
                    <p className="truncate text-sm font-medium text-slate-800">{r.title}</p>
                    {r.subtitle && <p className="truncate text-xs text-slate-400">{r.subtitle}</p>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

export default GlobalSearch;
