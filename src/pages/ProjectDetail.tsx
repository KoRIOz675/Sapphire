import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import ProjectForm from "../components/forms/ProjectForm";
import EmptyState from "../components/EmptyState";
import AttachmentsSection from "../components/AttachmentsSection";
import { useProject, useProjectMutations } from "../hooks";
import { fmtDate } from "../utils";

export default function ProjectDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const mut = useProjectMutations();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <p className="text-slate-500">{t("common.loading")}</p>;
  if (!project) return <EmptyState title={t("common.empty")} />;

  const statusLabel =
    project.status === "Active"
      ? t("project.statuses.active")
      : t("project.statuses.inactive");

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={statusLabel}
        actions={
          <>
            <button className="btn-secondary" onClick={() => nav(-1)}>
              <ArrowLeft className="h-4 w-4" />
              {t("common.back")}
            </button>
            <button className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </button>
            <button className="btn-danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("project.description")}
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {project.description || "—"}
          </p>
        </section>

        <AttachmentsSection entityType="project" entityId={project.id} />

        <section className="card md:col-span-2 text-xs text-slate-500">
          <div>{t("common.created_at")} : {fmtDate(project.createdAt)}</div>
          <div>{t("common.updated_at")} : {fmtDate(project.updatedAt)}</div>
        </section>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`${t("common.edit")} — ${project.name}`}
        size="lg"
      >
        <ProjectForm
          initial={project}
          onSubmit={async (input) => {
            await mut.update.mutateAsync({ id: project.id, input });
            setEditOpen(false);
          }}
          onCancel={() => setEditOpen(false)}
          submitting={mut.update.isPending}
        />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await mut.remove.mutateAsync(project.id);
          nav("/projects");
        }}
        danger
      />
    </>
  );
}
