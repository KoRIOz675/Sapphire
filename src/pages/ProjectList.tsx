import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";

import PageHeader from "../components/PageHeader";
import DataTable, { Column } from "../components/DataTable";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import ProjectForm from "../components/forms/ProjectForm";
import { useProjectMutations, useProjects } from "../hooks";
import type { Project, ProjectInput, ProjectStatus } from "../types";
import { api } from "../api/tauri";
import { usePersistedTableState } from "../hooks/usePersistedTableState";
import { useRegisterCreateHandler } from "../context/ShortcutContext";

const PROJECT_STATUSES: ProjectStatus[] = ["Active", "Inactive"];

export default function ProjectList() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const mut = useProjectMutations();

  const [modalOpen, setModalOpen] = useState(false);
  useRegisterCreateHandler(() => { setEditTarget(undefined); setModalOpen(true); });
  const [editTarget, setEditTarget] = useState<Project | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Project | undefined>();

  const { state, setFilter, setSort } = usePersistedTableState("projects", {
    sortKey: null,
    sortDir: "asc",
    filters: { status: "" },
  });
  const statusFilter = state.filters.status ?? "";

  const filtered = useMemo(() => {
    if (!statusFilter) return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  const statusLabel = (s: ProjectStatus) =>
    s === "Active" ? t("project.statuses.active") : t("project.statuses.inactive");

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: t("project.name"),
      accessor: (p) => (
        <Link
          to={`/projects/${p.id}`}
          className="font-medium text-slate-900 hover:text-sapphire-700"
        >
          {p.name}
        </Link>
      ),
      searchValue: (p) => p.name,
      sortValue: (p) => p.name.toLowerCase(),
    },
    {
      key: "description",
      header: t("project.description"),
      accessor: (p) =>
        p.description ? (
          <span className="line-clamp-2 text-slate-700">{p.description}</span>
        ) : (
          "—"
        ),
      searchValue: (p) => p.description ?? "",
    },
    {
      key: "status",
      header: t("project.status"),
      accessor: (p) => statusLabel(p.status),
      sortValue: (p) => p.status,
      className: "w-36",
    },
  ];

  async function onSubmit(input: ProjectInput) {
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

  async function onExportCsv() {
    await api.exportCsv("projects");
  }

  return (
    <>
      <PageHeader
        title={t("project.plural")}
        actions={
          <>
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
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          onRowClick={(p) => nav(`/projects/${p.id}`)}
          sortKey={state.sortKey}
          sortDir={state.sortDir}
          onSortChange={setSort}
          filters={
            <select
              className="input max-w-[200px]"
              value={statusFilter}
              onChange={(e) => setFilter("status", e.target.value)}
            >
              <option value="">
                {t("common.all")} {t("project.status")}
              </option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          }
          actions={(p) => (
            <div className="flex items-center justify-end gap-1">
              <button
                className="btn-secondary px-2 py-1"
                onClick={() => {
                  setEditTarget(p);
                  setModalOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                className="btn-danger px-2 py-1"
                onClick={() => setDeleteTarget(p)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editTarget
            ? `${t("common.edit")} — ${editTarget.name}`
            : `${t("common.add")} ${t("project.singular")}`
        }
        size="lg"
      >
        <ProjectForm
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
