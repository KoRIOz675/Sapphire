import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  Building2,
  ListChecks,
  FolderKanban,
  CalendarDays,
  Settings as SettingsIcon,
  BookOpen,
} from "lucide-react";
import clsx from "clsx";

import logoUrl from "../assets/logo.svg";

interface SidebarProps {
  searchSlot?: ReactNode;
}

export default function Sidebar({ searchSlot }: SidebarProps) {
  const { t } = useTranslation();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: t("nav.dashboard"), end: true },
    { to: "/people", icon: Users, label: t("nav.people") },
    { to: "/company", icon: Building2, label: t("nav.companies") },
    { to: "/actions", icon: ListChecks, label: t("nav.actions") },
    { to: "/projects", icon: FolderKanban, label: t("nav.projects") },
    { to: "/calendar", icon: CalendarDays, label: t("nav.calendar") },
    { to: "/guide", icon: BookOpen, label: t("nav.guide") },
  ];

  return (
    <aside className="flex h-full w-60 flex-none flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <img src={logoUrl} alt={t("app.title")} className="h-7 w-7 shrink-0" />
        <span className="font-semibold text-slate-900">{t("app.title")}</span>
      </div>

      {searchSlot}

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-sapphire-50 text-sapphire-700"
                  : "text-slate-600 hover:bg-slate-100",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-2 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
              isActive
                ? "bg-sapphire-50 text-sapphire-700"
                : "text-slate-600 hover:bg-slate-100",
            )
          }
        >
          <SettingsIcon className="h-4 w-4" />
          {t("nav.settings")}
        </NavLink>
      </div>
    </aside>
  );
}
