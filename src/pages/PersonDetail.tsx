import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import PersonForm from "../components/forms/PersonForm";
import EmptyState from "../components/EmptyState";
import Badge, { statusTone } from "../components/Badge";
import TagInput from "../components/TagInput";
import AttachmentsSection from "../components/AttachmentsSection";
import {
  useActions,
  useCompanies,
  usePerson,
  usePersonMutations,
  usePersons,
  usePersonTags,
  useTags,
  useTagMutations,
} from "../hooks";
import { fmtDate, fmtDay, fullName } from "../utils";

export default function PersonDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: person, isLoading } = usePerson(id);
  const { data: persons = [] } = usePersons();
  const { data: companies = [] } = useCompanies();
  const { data: actions = [] } = useActions();
  const { data: allTags = [] } = useTags();
  const { data: personTags = [] } = usePersonTags(id);
  const tagMut = useTagMutations();

  const mut = usePersonMutations();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const byId = useMemo(() => {
    const pm = new Map(persons.map((p) => [p.id, p]));
    const cm = new Map(companies.map((c) => [c.id, c]));
    return { pm, cm };
  }, [persons, companies]);

  if (isLoading) return <p className="text-slate-500">{t("common.loading")}</p>;
  if (!person) return <EmptyState title={t("common.empty")} />;

  const company = person.currentCompanyId
    ? byId.cm.get(person.currentCompanyId)
    : undefined;
  const primarySrc = person.primarySourceId
    ? byId.pm.get(person.primarySourceId)
    : undefined;
  const manager = person.directManagerId
    ? byId.pm.get(person.directManagerId)
    : undefined;
  const secondarySources = person.secondarySourceIds
    .map((sid) => byId.pm.get(sid))
    .filter(Boolean);

  const primarySourceFor = persons.filter((p) => p.primarySourceId === person.id);
  const managedPersons = persons.filter((p) => p.directManagerId === person.id);
  const actionsTo = actions.filter((a) => a.toPersonIds.includes(person.id));

  return (
    <>
      <PageHeader
        title={fullName(person)}
        subtitle={[person.role, person.department].filter(Boolean).join(" · ")}
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
            {t("person.singular")}
          </h3>
          <Field label={t("person.department")} value={person.department} />
          <Field label={t("person.role")} value={person.role} />
          <Field label={t("person.circle_of_relation")}
            value={person.circleOfRelation?.toString()} />
          <Field label={t("person.birthday")} value={person.birthday} />
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("person.professional_email")} / {t("person.mobile_phone")}
          </h3>
          <Field label={t("person.mobile_phone")} value={person.mobilePhone} />
          <Field
            label={t("person.professional_email")}
            value={person.professionalEmail}
          />
          {person.otherEmails.length > 0 && (
            <div className="mt-2">
              <div className="text-xs uppercase text-slate-500">
                {t("person.other_emails")}
              </div>
              <ul className="list-disc pl-5 text-sm">
                {person.otherEmails.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("person.current_company")}
          </h3>
          {company ? (
            <Link
              to={`/company/${company.id}`}
              className="text-sm font-medium text-sapphire-700 hover:underline"
            >
              {company.name}
            </Link>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("person.singular")} — relations
          </h3>
          <Relation
            label={t("person.primary_source")}
            item={primarySrc && { id: primarySrc.id, name: fullName(primarySrc) }}
            to="people"
          />
          <Relation
            label={t("person.direct_manager")}
            item={manager && { id: manager.id, name: fullName(manager) }}
            to="people"
          />
          <RelationList
            label={t("person.secondary_sources")}
            items={secondarySources.map((p) => ({ id: p!.id, name: fullName(p!) }))}
            to="people"
          />
          <RelationList
            label={t("person.primary_source_for")}
            items={primarySourceFor.map((p) => ({ id: p.id, name: fullName(p) }))}
            to="people"
          />
          <RelationList
            label={t("person.direct_manager_for")}
            items={managedPersons.map((p) => ({ id: p.id, name: fullName(p) }))}
            to="people"
          />
        </section>

        <section className="card md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("tag.plural")}
          </h3>
          <TagInput
            allTags={allTags}
            selectedIds={personTags.map((tag) => tag.id)}
            onChange={(tagIds) =>
              tagMut.setPersonTags.mutate({ personId: person.id, tagIds })
            }
            onCreateTag={async (name, color) => {
              return await tagMut.create.mutateAsync({ name, color });
            }}
          />
        </section>

        <section className="card md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("person.additional_information")}
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {person.additionalInformation || "—"}
          </p>
        </section>

        <section className="card md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("person.actions_to")}
          </h3>
          {actionsTo.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">{t("common.empty")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {actionsTo.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2"
                >
                  <Link
                    to={`/actions/${a.id}`}
                    className="text-sm font-medium text-sapphire-700 hover:underline"
                  >
                    {a.title}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    <span className="text-xs text-slate-500">
                      {fmtDay(a.scheduledDate)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AttachmentsSection entityType="person" entityId={person.id} />

        <section className="card md:col-span-2 text-xs text-slate-500">
          <div>{t("common.created_at")} : {fmtDate(person.createdAt)}</div>
          <div>{t("common.updated_at")} : {fmtDate(person.updatedAt)}</div>
        </section>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`${t("common.edit")} — ${fullName(person)}`}
        size="lg"
      >
        <PersonForm
          initial={person}
          onSubmit={async (input) => {
            await mut.update.mutateAsync({ id: person.id, input });
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
          await mut.remove.mutateAsync(person.id);
          nav("/people");
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
  value?: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || "—"}</span>
    </div>
  );
}

function Relation({
  label,
  item,
  to,
}: {
  label: string;
  item?: { id: string; name: string };
  to: "people" | "company";
}) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      {item ? (
        <Link
          to={`/${to}/${item.id}`}
          className="font-medium text-sapphire-700 hover:underline"
        >
          {item.name}
        </Link>
      ) : (
        <span className="text-slate-400">—</span>
      )}
    </div>
  );
}

function RelationList({
  label,
  items,
  to,
}: {
  label: string;
  items: { id: string; name: string }[];
  to: "people" | "company";
}) {
  return (
    <div className="py-1 text-sm">
      <div className="mb-1 text-slate-500">{label}</div>
      {items.length === 0 ? (
        <span className="text-slate-400">—</span>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                to={`/${to}/${i.id}`}
                className="badge bg-sapphire-50 text-sapphire-700 hover:bg-sapphire-100"
              >
                {i.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
