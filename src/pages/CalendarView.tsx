import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid } from "lucide-react";
import clsx from "clsx";

import PageHeader from "../components/PageHeader";
import { statusTone } from "../components/Badge";
import { actionDayKey, dayKey } from "../dates";
import { useActions } from "../hooks";
import type { Action } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  // Monday-based week
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function monthLabel(d: Date, locale?: string): string {
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function weekLabel(start: Date, locale?: string): string {
  const end = addDays(start, 6);
  const s = start.toLocaleDateString(locale, { month: "short", day: "numeric" });
  const e = end.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

const EVENT_TONE_CLASS: Record<string, string> = {
  amber: "text-amber-800 hover:bg-amber-100",
  blue: "text-blue-700 hover:bg-blue-100",
  green: "text-green-700 hover:bg-green-100",
  slate: "text-slate-700 hover:bg-slate-100",
  red: "text-red-700 hover:bg-red-100",
  violet: "text-violet-700 hover:bg-violet-100",
};

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({
  date,
  actions,
  isToday,
  isOtherMonth,
  compact,
}: {
  date: Date;
  actions: Action[];
  isToday: boolean;
  isOtherMonth?: boolean;
  compact?: boolean; // month view = compact
}) {
  const dayNum = date.getDate();

  return (
    <div
      className={clsx(
        "min-h-[80px] rounded-md border p-1.5",
        isToday ? "border-sapphire-400 bg-sapphire-50/60" : "border-slate-200 bg-white",
        isOtherMonth && "opacity-40",
      )}
    >
      <div
        className={clsx(
          "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
          isToday
            ? "bg-sapphire-600 text-white"
            : "text-slate-500",
        )}
      >
        {dayNum}
      </div>

      <div className="space-y-0.5">
        {actions.slice(0, compact ? 2 : 99).map((a) => (
          <Link
            key={a.id}
            to={`/actions/${a.id}`}
            className={`block truncate rounded-sm px-1 py-0.5 text-xs font-medium ${EVENT_TONE_CLASS[statusTone(a.status)]}`}
            title={a.title}
          >
            {a.title}
          </Link>
        ))}
        {compact && actions.length > 2 && (
          <p className="pl-1 text-xs text-slate-400">+{actions.length - 2}</p>
        )}
      </div>
    </div>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MonthView({
  anchor,
  byDate,
  today,
}: {
  anchor: Date;
  byDate: Map<string, Action[]>;
  today: string;
}) {

  // Build 6-week grid starting from Monday before first of month
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const ds = dayKey(cell);
          return (
            <DayCell
              key={ds}
              date={cell}
              actions={byDate.get(ds) ?? []}
              isToday={ds === today}
              isOtherMonth={cell.getMonth() !== anchor.getMonth()}
              compact
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  anchor,
  byDate,
  today,
}: {
  anchor: Date;
  byDate: Map<string, Action[]>;
  today: string;
}) {

  const monday = startOfWeek(anchor);
  const cells: Date[] = [];
  for (let i = 0; i < 7; i++) cells.push(addDays(monday, i));

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-2">
        {DAY_NAMES.map((d, i) => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
            {d}
            <span className="ml-1 text-slate-300">
              {cells[i].getDate()}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          const ds = dayKey(cell);
          return (
            <DayCell
              key={ds}
              date={cell}
              actions={byDate.get(ds) ?? []}
              isToday={ds === today}
              compact={false}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week";

export default function CalendarView() {
  const { t } = useTranslation();
  const { data: actions = [], isLoading } = useActions();

  const today = dayKey(new Date());
  const [mode, setMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(new Date());

  // Group actions by scheduled date
  const byDate = useMemo(() => {
    const m = new Map<string, Action[]>();
    for (const a of actions) {
      const d = actionDayKey(a.scheduledDate);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(a);
    }
    return m;
  }, [actions]);

  function navigate(dir: -1 | 1) {
    const next = new Date(anchor);
    if (mode === "month") {
      next.setMonth(next.getMonth() + dir);
    } else {
      next.setDate(next.getDate() + dir * 7);
    }
    setAnchor(next);
  }

  const title =
    mode === "month"
      ? monthLabel(anchor)
      : weekLabel(startOfWeek(anchor));

  return (
    <>
      <PageHeader
        title={t("nav.calendar")}
        actions={
          <div className="flex items-center gap-2">
            {/* Month / Week toggle */}
            <div className="flex rounded-md border border-sapphire-300 overflow-hidden">
              <button
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "month"
                    ? "bg-sapphire-600 text-white"
                    : "bg-white text-sapphire-700 hover:bg-sapphire-50",
                )}
                onClick={() => setMode("month")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium transition-colors border-l border-sapphire-300",
                  mode === "week"
                    ? "bg-sapphire-600 text-white"
                    : "bg-white text-sapphire-700 hover:bg-sapphire-50",
                )}
                onClick={() => setMode("week")}
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation */}
            <button
              className="btn-secondary px-2 py-1"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[180px] text-center text-sm font-medium text-slate-700">
              {title}
            </span>
            <button
              className="btn-secondary px-2 py-1"
              onClick={() => navigate(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Today */}
            <button
              className="btn-secondary px-3 py-1.5 text-sm"
              onClick={() => setAnchor(new Date())}
            >
              {t("calendar.today")}
            </button>
          </div>
        }
      />

      {isLoading ? (
        <p className="text-slate-500">{t("common.loading")}</p>
      ) : mode === "month" ? (
        <MonthView anchor={anchor} byDate={byDate} today={today} />
      ) : (
        <WeekView anchor={anchor} byDate={byDate} today={today} />
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        {(["to do", "in progress", "done"] as const).map((s) => {
          const key = s === "to do" ? "todo" : s.replace(" ", "_");
          const dotClass: Record<string, string> = {
            amber: "bg-amber-400",
            blue: "bg-blue-400",
            green: "bg-green-400",
            slate: "bg-slate-300",
            red: "bg-red-400",
            violet: "bg-violet-400",
          };
          return (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${dotClass[statusTone(s)]}`} />
              {t(`action.statuses.${key}`)}
            </span>
          );
        })}
      </div>
    </>
  );
}
