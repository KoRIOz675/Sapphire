import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Download, Pencil, Trash2, List, LayoutDashboard } from "lucide-react";

import PageHeader from "../components/PageHeader";
import DataTable, { Column } from "../components/DataTable";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import ActionForm from "../components/forms/ActionForm";
import Badge, { statusTone } from "../components/Badge";
import KanbanBoard from "../components/kanban/KanbanBoard";
import {
  useActionMutations,
  useActions,
  useCurrentUser,
  usePersons,
} from "../hooks";
import type { Action, ActionInput } from "../types";
import { DISCUSSION_TYPES } from "../types";
import { api } from "../api/tauri";
import { fmtDay, fullName } from "../utils";
import { usePersistedTableState } from "../hooks/usePersistedTableState";
import { useRegisterCreateHandler } from "../context/ShortcutContext";

const dtKey = (d: string) => d.toLowerCase().replace(/\s+/g, "_");

type ViewMode = "list" | "kanban";

export default function ActionList() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data: actions = [], isLoading } = useActions();
  const { data: persons = [] } = usePersons();
  const { data: currentUser } = useCurrentUser();
  const mut = useActionMutations();

  const initiatorLabel =
    currentUser && (currentUser.firstName || currentUser.lastName)
      ? fullName(currentUser)
      : t("settings.user_not_set");

  const [modalOpen, setModalOpen] = useState(false);
  useRegisterCreateHandler(() => { setEditTarget(undefined); setModalOpen(true); });
  const [editTarget, setEditTarget] = useState<Action | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Action | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("actions.viewMode") as ViewMode) ?? "list",
  );

  function handleViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem("actions.viewMode", mode);
  }

  const { state, setFilter, setSort } = usePersistedTableState("actions", {
    sortKey: "scheduledDate",
    sortDir: "desc",
    filters: { status: "", type: "" },
  });
  const statusFilter = state.filters.status ?? "";
  const typeFilter = state.filters.type ?? "";

  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons],
  );

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (typeFilter && a.discussionType !== typeFilter) return false;
      return true;
    });
  }, [actions, statusFilter, typeFilter]);

  const discussionLabel = (d: string | null | undefined) =>
    d ? t(`action.discussion_types.${dtKey(d)}`, { defaultValue: d }) : "—";

  const columns: Column<Action>[] = [
    {
      key: "title",
      header: t("action.title"),
      accessor: (a) => (
        <Link
          to={`/actions/${a.id}`}
          className="font-medium text-slate-900 hover:text-sapphire-700"
        >
          {a.title}
        </Link>
      ),
      searchValue: (a) => a.title,
      sortValue: (a) => a.title.toLowerCase(),
    },
    {
      key: "from",
      header: t("action.from_person"),
      accessor: () => initiatorLabel,
      sortValue: () => initiatorLabel.toLowerCase(),
    },
    {
      key: "to",
      header: t("action.to_persons"),
      accessor: (a) => {
        if (a.toPersonIds.length === 0) return "—";
        const names = a.toPersonIds
          .map((id) => personById.get(id))
          .filter(Boolean)
          .map((p) => fullName(p!));
        return (
          <span className="text-xs text-slate-700">
            {names.slice(0, 2).join(", ")}
            {names.length > 2 && (
              <span className="text-slate-500"> +{names.length - 2}</span>
            )}
          </span>
        );
      },
      searchValue: (a) =>
        a.toPersonIds
          .map((id) => personById.get(id))
          .filter(Boolean)
          .map((p) => fullName(p!))
          .join(" "),
    },
    {
      key: "scheduledDate",
      header: t("action.scheduled_date"),
      accessor: (a) => fmtDay(a.scheduledDate),
      sortValue: (a) => a.scheduledDate,
      className: "w-40",
    },
    {
      key: "status",
      header: t("action.status"),
      accessor: (a) => <Badge tone={statusTone(a.status)}>{a.status}</Badge>,
      sortValue: (a) => a.status,
      className: "w-32",
    },
    {
      key: "type",
      header: t("action.discussion_type"),
      accessor: (a) => discussionLabel(a.discussionType),
      sortValue: (a) => discussionLabel(a.discussionType).toLowerCase(),
      className: "w-36",
    },
  ];

  async function onSubmit(input: ActionInput) {
    if (editTarget) {
      await mut.update.mutateAsync({ id: editTarget.id, input });
    } else {
      await mut.create.mutateAsync(input);
    }
    setModalOpen(false);
    setEditTarget(undefined);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await mut.remove.mutateAsync(deleteTarget.id);
    setDeleteTarget(undefined);
  }

  async function handleStatusChange(action: Action, newStatus: "to do" | "in progress" | "done") {
    const input: ActionInput = {
      title: action.title,
      status: newStatus,
      preparation: action.preparation ?? null,
      conclusion: action.conclusion ?? null,
      scheduledDate: action.scheduledDate,
      completedDate: action.completedDate ?? null,
      discussionType: action.discussionType ?? null,
      toPersonIds: action.toPersonIds,
    };
    await mut.update.mutateAsync({ id: action.id, input });
  }

  async function onExportCsv() {
    await api.exportCsv("actions");
  }

  // View toggle button group
  const viewToggle = (
    <div className="flex rounded-md border border-slate-200 overflow-hidden">
      <button
        className={`px-2 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${
          viewMode === "list"
            ? "bg-sapphire-600 text-white"
            : "bg-white text-slate-500 hover:bg-slate-50"
        }`}
        onClick={() => handleViewMode("list")}
        title={t("action.view_list")}
      >
        <List className="h-3.5 w-3.5" />
        {t("action.view_list")}
      </button>
      <button
        className={`px-2 py-1.5 flex items-center gap-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${
          viewMode === "kanban"
            ? "bg-sapphire-600 text-white"
            : "bg-white text-slate-500 hover:bg-slate-50"
        }`}
        onClick={() => handleViewMode("kanban")}
        title={t("action.view_kanban")}
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        {t("action.view_kanban")}
      </button>
    </div>
  );

  // Status/type filters (shared between both views)
  const filterControls = (
    <>
      <select
        className="input max-w-[200px]"
        value={statusFilter}
        onChange={(e) => setFilter("status", e.target.value)}
      >
        <option value="">{t("common.all")} {t("action.status")}</option>
        <option value="to do">{t("action.statuses.todo")}</option>
        <option value="in progress">{t("action.statuses.in_progress")}</option>
        <option value="done">{t("action.statuses.done")}</option>
      </select>
      <select
        className="input max-w-[200px]"
        value={typeFilter}
        onChange={(e) => setFilter("type", e.target.value)}
      >
        <option value="">{t("common.all")} {t("action.discussion_type")}</option>
        {DISCUSSION_TYPES.map((d) => (
          <option key={d} value={d}>{discussionLabel(d)}</option>
        ))}
      </select>
    </>
  );

  return (
    <>
      <PageHeader
        title={t("action.plural")}
        actions={
          <>
            {viewToggle}
            <button className="btn-secondary" onClick={onExportCsv}>
              <Download className="h-4 w-4" />
              {t("common.export_csv")}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setEditTarget(undefined);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("common.add")}
            </button>
          </>
        }
      />

      {isLoading ? (
        <p className="text-slate-500">{t("common.loading")}</p>
      ) : viewMode === "list" ? (
        <DataTable
          rows={filtered}
          columns={columns}
          onRowClick={(a) => nav(`/actions/${a.id}`)}
          sortKey={state.sortKey}
          sortDir={state.sortDir}
          onSortChange={setSort}
          filters={filterControls}
          actions={(a) => (
            <div className="flex items-center justify-end gap-1">
              <button
                className="btn-secondary px-2 py-1"
                onClick={() => { setEditTarget(a); setModalOpen(true); }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                className="btn-danger px-2 py-1"
                onClick={() => setDeleteTarget(a)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        />
      ) : (
        <>
          {/* Filters bar in kanban mode */}
          <div className="mb-4 flex flex-wrap gap-2">
            {filterControls}
          </div>
          <KanbanBoard
            actions={filtered}
            personById={personById}
            onStatusChange={handleStatusChange}
            onEdit={(a) => { setEditTarget(a); setModalOpen(true); }}
            onDelete={(a) => setDeleteTarget(a)}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editTarget
            ? `${t("common.edit")} — ${editTarget.title}`
            : `${t("common.add")} ${t("action.singular")}`
        }
        size="lg"
      >
        <ActionForm
          initial={editTarget}
          onSubmit={onSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={mut.create.isPending || mut.update.isPending}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        danger
      />
    </>
  );
}
