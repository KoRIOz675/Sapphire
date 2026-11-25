import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import MiniCalendar from "../components/MiniCalendar";
import { useDashboard } from "../hooks";
import { fmtDay } from "../utils";
import Badge, { statusTone } from "../components/Badge";
import { api } from "../api/tauri";

export default function Dashboard() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data, isLoading } = useDashboard();
  const [showOverdue, setShowOverdue] = useState(true);
  const [showStale, setShowStale] = useState(true);

  useEffect(() => {
    (async () => {
      setShowOverdue((await api.getSetting("dashboard_show_overdue")) !== "false");
      setShowStale((await api.getSetting("dashboard_show_stale_contacts")) !== "false");
    })();
  }, []);

  if (isLoading || !data) {
    return <p className="text-sapphire-400">{t("common.loading")}</p>;
  }

  return (
    <>
      <PageHeader title={t("nav.dashboard")} />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={t("person.plural")} value={data.personsCount} to="/people" />
        <StatCard label={t("company.plural")} value={data.companiesCount} to="/company" />
        <StatCard label={t("action.plural")} value={data.actionsCount} to="/actions" />
        <StatCard label={t("project.plural")} value={data.projectsCount} to="/projects" />
      </section>

      {((showOverdue && data.overdueActionsCount > 0) || (showStale && data.staleContactsCount > 0)) && (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {showOverdue && data.overdueActionsCount > 0 && (
            <div className="card border-l-4 border-l-red-400">
              <p className="text-xs uppercase tracking-wide text-red-500">
                {t("dashboard.overdue_actions_count")}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.overdueActionsCount}</p>
            </div>
          )}
          {showStale && data.staleContactsCount > 0 && (
            <div className="card border-l-4 border-l-amber-400">
              <p className="text-xs uppercase tracking-wide text-amber-600">
                {t("dashboard.stale_contacts")}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.staleContactsCount}</p>
            </div>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sapphire-500">
          {t("dashboard.by_circle")}
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {data.circleCounts.map((n, i) => (
            <button
              key={i}
              className="card text-left transition-colors hover:border-sapphire-400 hover:bg-sapphire-50"
              onClick={() => nav("/people", { state: { circleFilter: String(i + 1) } })}
            >
              <div className="text-xs text-sapphire-500">
                {t("person.circle_short")} {i + 1}
              </div>
              <div className="mt-1 text-2xl font-bold text-sapphire-900">{n}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 card">
        <MiniCalendar />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sapphire-500">
            {t("dashboard.upcoming_actions")}
          </h2>
          {data.upcomingActions.length === 0 ? (
            <p className="py-4 text-sm text-sapphire-400">{t("common.empty")}</p>
          ) : (
            <ul className="divide-y divide-sapphire-100">
              {data.upcomingActions.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <Link
                    to={`/actions/${a.id}`}
                    className="text-sm font-medium text-sapphire-700 hover:underline"
                  >
                    {a.title}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    <span className="text-xs text-sapphire-400">
                      {fmtDay(a.scheduledDate)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {showOverdue && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sapphire-500">
            {t("dashboard.overdue_actions_list")}
          </h2>
          {data.overdueActions.length === 0 ? (
            <p className="py-4 text-sm text-sapphire-400">{t("common.empty")}</p>
          ) : (
            <ul className="divide-y divide-sapphire-100">
              {data.overdueActions.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <Link
                    to={`/actions/${a.id}`}
                    className="text-sm font-medium text-sapphire-700 hover:underline"
                  >
                    {a.title}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    <span className="text-xs text-red-400">
                      {fmtDay(a.scheduledDate)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </section>
    </>
  );
}

function StatCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="card transition-colors hover:border-sapphire-400 hover:bg-sapphire-50"
    >
      <div className="text-xs uppercase tracking-wide text-sapphire-500">{label}</div>
      <div className="mt-1 text-3xl font-bold text-sapphire-900">{value}</div>
    </Link>
  );
}
