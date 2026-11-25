import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Pencil, Trash2, X } from "lucide-react";

import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import ActionForm from "../components/forms/ActionForm";
import EmptyState from "../components/EmptyState";
import Badge, { statusTone } from "../components/Badge";
import MarkdownEditor, { MarkdownContent } from "../components/MarkdownEditor";
import AttachmentsSection from "../components/AttachmentsSection";
import { useAction, useActionMutations, useCurrentUser, usePersons } from "../hooks";
import type { ActionInput } from "../types";
import { fmtDate, fullName } from "../utils";

const dtKey = (d: string) => d.toLowerCase().replace(/\s+/g, "_");

export default function ActionDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: action, isLoading } = useAction(id);
  const { data: persons = [] } = usePersons();
  const { data: currentUser } = useCurrentUser();
  const mut = useActionMutations();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons],
  );

  if (isLoading) return <p className="text-slate-500">{t("common.loading")}</p>;
  if (!action) return <EmptyState title={t("common.empty")} />;

  const initiatorLabel =
    currentUser && (currentUser.firstName || currentUser.lastName)
      ? fullName(currentUser)
      : t("settings.user_not_set");
  const to = action.toPersonIds.map((id) => personById.get(id)).filter(Boolean);

  const discussionLabel = action.discussionType
    ? t(`action.discussion_types.${dtKey(action.discussionType)}`, {
        defaultValue: action.discussionType,
      })
    : null;

  async function saveField(patch: Partial<ActionInput>) {
    if (!action) return;
    const input: ActionInput = {
      title: action.title,
      status: action.status,
      preparation: action.preparation ?? null,
      conclusion: action.conclusion ?? null,
      scheduledDate: action.scheduledDate,
      completedDate: action.completedDate ?? null,
      discussionType: action.discussionType ?? null,
      toPersonIds: action.toPersonIds ?? [],
      ...patch,
    };
    await mut.update.mutateAsync({ id: action.id, input });
  }

  return (
    <>
      <PageHeader
        title={action.title}
        subtitle={discussionLabel ?? undefined}
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
        <section className="card">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("action.singular")}
          </h3>
          <Field
            label={t("action.status")}
            value={<Badge tone={statusTone(action.status)}>{action.status}</Badge>}
          />
          <Field label={t("action.discussion_type")} value={discussionLabel} />
          <Field
            label={t("action.scheduled_date")}
            value={fmtDate(action.scheduledDate)}
          />
          <Field
            label={t("action.completed_date")}
            value={fmtDate(action.completedDate)}
          />
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("action.from_person")} / {t("action.to_persons")}
          </h3>
          <div className="py-1 text-sm">
            <span className="text-slate-500">{t("action.from_person")} : </span>
            <span className="font-medium text-slate-800">{initiatorLabel}</span>
          </div>
          <div className="py-1 text-sm">
            <div className="mb-1 text-slate-500">
              {t("action.to_persons")} :
            </div>
            {to.length === 0 ? (
              "—"
            ) : (
              <ul className="flex flex-wrap gap-1">
                {to.map((p) => (
                  <li key={p!.id}>
                    <Link
                      to={`/people/${p!.id}`}
                      className="badge bg-sapphire-50 text-sapphire-700 hover:bg-sapphire-100"
                    >
                      {fullName(p!)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <InlineTextSection
          title={t("action.preparation")}
          value={action.preparation ?? ""}
          onSave={(v) => saveField({ preparation: v || null })}
          saving={mut.update.isPending}
          emptyLabel={t("common.empty")}
        />

        <InlineTextSection
          title={t("action.conclusion")}
          value={action.conclusion ?? ""}
          onSave={(v) => saveField({ conclusion: v || null })}
          saving={mut.update.isPending}
          emptyLabel={t("common.empty")}
        />

        <AttachmentsSection entityType="action" entityId={action.id} />

        <section className="card md:col-span-2 text-xs text-slate-500">
          <div>{t("common.created_at")} : {fmtDate(action.createdAt)}</div>
          <div>{t("common.updated_at")} : {fmtDate(action.updatedAt)}</div>
        </section>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`${t("common.edit")} — ${action.title}`}
        size="lg"
      >
        <ActionForm
          initial={action}
          onSubmit={async (input) => {
            await mut.update.mutateAsync({ id: action.id, input });
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
          await mut.remove.mutateAsync(action.id);
          nav("/actions");
        }}
        danger
      />
    </>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | React.ReactNode | null;
}) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || "—"}</span>
    </div>
  );
}

function InlineTextSection({
  title,
  value,
  onSave,
  saving,
  emptyLabel,
}: {
  title: string;
  value: string;
  onSave: (v: string) => Promise<unknown>;
  saving?: boolean;
  emptyLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Re-sync when the underlying action data is refetched (after a save).
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const dirty = draft !== value;

  async function handleSave() {
    await onSave(draft);
    setEditing(false);
  }

  return (
    <section className="card md:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        {!editing ? (
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-xs"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="btn-primary px-2 py-1 text-xs"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          minHeight="120px"
        />
      ) : (
        <MarkdownContent html={value || undefined} />
      )}
    </section>
  );
}
