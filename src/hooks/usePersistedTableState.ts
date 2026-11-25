/**
 * usePersistedTableState
 *
 * Manages filter + sort state for a list page with two-layer persistence:
 *  1. localStorage  — instant read on mount (no loading flash)
 *  2. settings SQLite — durable across machines / app reinstalls
 *
 * On mount: reads from localStorage immediately, then tries SQLite and merges.
 * On change: writes to localStorage synchronously, debounces SQLite write.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/tauri";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filters = Record<string, any>;

export interface TableState {
  sortKey: string | null;
  sortDir: "asc" | "desc";
  filters: Filters;
}

const DEBOUNCE_MS = 800;

function settingKey(pageKey: string) {
  return `ui_table_state_${pageKey}`;
}

function readLocal(pageKey: string): TableState | null {
  try {
    const raw = localStorage.getItem(settingKey(pageKey));
    if (!raw) return null;
    return JSON.parse(raw) as TableState;
  } catch {
    return null;
  }
}

function writeLocal(pageKey: string, state: TableState) {
  try {
    localStorage.setItem(settingKey(pageKey), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function usePersistedTableState(
  pageKey: string,
  defaultState: TableState,
) {
  const [state, setState] = useState<TableState>(() => {
    const saved = readLocal(pageKey);
    // Restore sort preferences only — filters always reset to defaults on mount
    return saved
      ? { ...defaultState, sortKey: saved.sortKey, sortDir: saved.sortDir }
      : defaultState;
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: load sort from SQLite (filters stay at defaults)
  useEffect(() => {
    let cancelled = false;
    api.getSetting(settingKey(pageKey)).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const remote = JSON.parse(raw) as TableState;
        setState((prev) => ({
          ...prev,
          sortKey: remote.sortKey,
          sortDir: remote.sortDir,
        }));
      } catch {
        /* ignore bad JSON */
      }
    });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  const update = useCallback(
    (patch: Partial<TableState> | ((prev: TableState) => Partial<TableState>)) => {
      setState((prev) => {
        const resolved = typeof patch === "function" ? patch(prev) : patch;
        const next: TableState = { ...prev, ...resolved };
        writeLocal(pageKey, next);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          api.setSetting(settingKey(pageKey), JSON.stringify(next));
        }, DEBOUNCE_MS);
        return next;
      });
    },
    [pageKey],
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      update((prev) => ({ filters: { ...prev.filters, [key]: value } }));
    },
    [update],
  );

  const setSort = useCallback(
    (sortKey: string, sortDir: "asc" | "desc") => {
      update({ sortKey, sortDir });
    },
    [update],
  );

  return { state, setFilter, setSort };
}
