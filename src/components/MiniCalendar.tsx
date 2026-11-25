import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { actionDayKey, dayKey } from "../dates";
import { useActions } from "../hooks";
import type { Action } from "../types";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export default function MiniCalendar() {
  const { t } = useTranslation();
  const { data: actions = [] } = useActions();

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  const todayStr = dayKey(new Date());

  const byDate = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const a of actions) {
      if (a.status === "done") continue;
      const dateKey = actionDayKey(a.scheduledDate);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(a);
    }
    return map;
  }, [actions]);

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sapphire-500">
        {t("dashboard.mini_calendar")}
      </h2>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_ABBR.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-sapphire-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = dayKey(day);
          const dayActions = byDate.get(dateKey) ?? [];
          const isToday = dateKey === todayStr;
          const isWeekend = mondayIndex(day) >= 5;

          return (
            <div
              key={dateKey}
              className={clsx(
                "min-h-[80px] rounded-md border p-1.5",
                isToday
                  ? "border-sapphire-400 bg-sapphire-50"
                  : isWeekend
                  ? "border-sapphire-100 bg-sapphire-50/40"
                  : "border-sapphire-200 bg-white",
              )}
            >
              <div
                className={clsx(
                  "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                  isToday ? "bg-sapphire-600 text-white" : "text-sapphire-700",
                )}
              >
                {day.getDate()}
              </div>

              <div className="space-y-0.5">
                {dayActions.slice(0, 3).map((a) => (
                  <Link
                    key={a.id}
                    to={`/actions/${a.id}`}
                    title={a.title}
                    className={clsx(
                      "block truncate rounded-sm px-1 py-0.5 text-[10px] font-medium leading-tight transition-colors",
                      a.status === "in progress"
                        ? "bg-sapphire-200 text-sapphire-900 hover:bg-sapphire-300"
                        : "bg-sapphire-100 text-sapphire-800 hover:bg-sapphire-200",
                    )}
                  >
                    {a.title}
                  </Link>
                ))}
                {dayActions.length > 3 && (
                  <p className="pl-1 text-[10px] text-sapphire-400">
                    +{dayActions.length - 3}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
