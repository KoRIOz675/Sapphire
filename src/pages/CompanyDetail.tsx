import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import CompanyForm from "../components/forms/CompanyForm";
import EmptyState from "../components/EmptyState";
import Badge, { statusTone } from "../components/Badge";
import TagInput from "../components/TagInput";
import AttachmentsSection from "../components/AttachmentsSection";
import {
  useActions,
  useCompanies,
  useCompany,
  useCompanyMutations,
  useCompanyTags,
  usePersons,
  useProjects,
  useTags,
  useTagMutations,
} from "../hooks";
import { fmtDate, fmtDay, fullName } from "../utils";
import { safeHttpUrl } from "../url";

export default function CompanyDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: company, isLoading } = useCompany(id);
  const { data: companies = [] } = useCompanies();
  const { data: persons = [] } = usePersons();
  const { data: projects = [] } = useProjects();
  const { data: actions = [] } = useActions();
  const { data: allTags = [] } = useTags();
  const { data: companyTags = [] } = useCompanyTags(id);
  const tagMut = useTagMutations();

  const mut = useCompanyMutations();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { parent, subs, employees, relatedProjects, targetingActions } =
    useMemo(() => {
      if (!company) {
        return {
          parent: undefined,
          subs: [] as typeof companies,
          employees: [] as typeof persons,
          relatedProjects: [] as typeof projects,
          targetingActions: [] as typeof actions,
        };
      }
      const parent = company.parentCompanyId
        ? companies.find((c) => c.id === company.parentCompanyId)
        : undefined;
      const subs = companies.filter((c) => c.parentCompanyId === company.id);
      const employees = persons.filter((p) => p.currentCompanyId === company.id);
      const relatedProjects = projects.filter((p) => p.companyIds.includes(company.id));
      const empIds = new Set(employees.map((e) => e.id));
      const targetingActions = actions.filter((a) =>
        a.toPersonIds.some((pid) => empIds.has(pid)),
      );
      return { parent, subs, employees, relatedProjects, targetingActions };
    }, [company, companies, persons, projects, actions]);

  if (isLoading) return <p className="text-slate-500">{t("common.loading")}</p>;
  if (!company) return <EmptyState title={t("common.empty")} />;

  const sectorLabel = company.sector
    ? t(`company.sectors.${company.sector.toLowerCase()}`, {
        defaultValue: company.sector,
      })
    : null;

  return (
    <>
      <PageHeader
        title={company.name}
        subtitle={[sectorLabel, company.size].filter(Boolean).join(" · ")}
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
            {t("company.singular")}
          </h3>
          <Field label={t("company.sector")} value={sectorLabel} />
          <Field label={t("company.size")} value={company.size} />
          <Field
            label={t("company.number_of_employees")}
            value={company.numberOfEmployees?.toString()}
          />
          <Field
            label={t("company.priority")}
            value={company.priority?.toString()}
          />
          <Field
            label={t("company.website")}
            value={
              company.website ? (
                <a
                  href={safeHttpUrl(company.website)}
                  className="text-sapphire-700 hover:underline"
                >
                  {company.website}
                </a>
              ) : undefined
            }
          />
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("company.description")}
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {company.description || "—"}
          </p>
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("company.parent_company")} / {t("company.subsidiaries")}
          </h3>
          <div className="text-sm">
            <div className="mb-2">
              <span className="text-slate-500">
                {t("company.parent_company")} :{" "}
              </span>
              {parent ? (
                <Link
                  to={`/company/${parent.id}`}
                  className="font-medium text-sapphire-700 hover:underline"
                >
                  {parent.name}
                </Link>
              ) : (
                "—"
              )}
            </div>
            <div>
              <div className="mb-1 text-slate-500">{t("company.subsidiaries")} :</div>
              {subs.length === 0 ? (
                "—"
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {subs.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/company/${s.id}`}
                        className="badge bg-sapphire-50 text-sapphire-700 hover:bg-sapphire-100"
                      >
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("company.projects")}
          </h3>
          {relatedProjects.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">{t("common.empty")}</p>
          ) : (
            <ul className="flex flex-wrap gap-1">
              {relatedProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="badge bg-violet-50 text-violet-700 hover:bg-violet-100"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("tag.plural")}
          </h3>
          <TagInput
            allTags={allTags}
            selectedIds={companyTags.map((tag) => tag.id)}
            onChange={(tagIds) =>
              tagMut.setCompanyTags.mutate({ companyId: company.id, tagIds })
            }
            onCreateTag={async (name, color) => {
              return await tagMut.create.mutateAsync({ name, color });
            }}
          />
        </section>

        <section className="card md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("company.employees")}
          </h3>
          {employees.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">{t("common.empty")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-1 md:grid-cols-3">
              {employees.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/people/${p.id}`}
                    className="text-sm text-sapphire-700 hover:underline"
                  >
                    {fullName(p)}
                    {p.role && (
                      <span className="text-slate-400"> — {p.role}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("company.actions_targeting")}
          </h3>
          {targetingActions.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">{t("common.empty")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {targetingActions.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
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

        <AttachmentsSection entityType="company" entityId={company.id} />

        <section className="card md:col-span-2 text-xs text-slate-500">
          <div>{t("common.created_at")} : {fmtDate(company.createdAt)}</div>
          <div>{t("common.updated_at")} : {fmtDate(company.updatedAt)}</div>
        </section>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`${t("common.edit")} — ${company.name}`}
        size="lg"
      >
        <CompanyForm
          initial={company}
          onSubmit={async (input) => {
            await mut.update.mutateAsync({ id: company.id, input });
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
          await mut.remove.mutateAsync(company.id);
          nav("/company");
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
