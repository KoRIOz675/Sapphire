import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import PageHeader from "../components/PageHeader";
import DataTable, { Column } from "../components/DataTable";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import PersonForm from "../components/forms/PersonForm";
import {
  useAllPersonTagIds,
  useCompanies,
  usePersonMutations,
  usePersons,
  useTags,
} from "../hooks";
import type { Person, PersonInput } from "../types";
import { api } from "../api/tauri";
import { fullName } from "../utils";
import { TagList } from "../components/TagInput";
import { usePersistedTableState } from "../hooks/usePersistedTableState";
import { useRegisterCreateHandler } from "../context/ShortcutContext";

export default function PeopleList() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const { data: persons = [], isLoading } = usePersons();
  const { data: companies = [] } = useCompanies();
  const { data: allTags = [] } = useTags();
  const { data: personTagIds = {} } = useAllPersonTagIds();

  const [modalOpen, setModalOpen] = useState(false);
  useRegisterCreateHandler(() => { setEditTarget(undefined); setModalOpen(true); });
  const [editTarget, setEditTarget] = useState<Person | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Person | undefined>();

  const { state, setFilter, setSort } = usePersistedTableState("persons", {
    sortKey: null,
    sortDir: "asc",
    filters: { circle: "", tag: "" },
  });
  const circleFilter = state.filters.circle ?? "";
  const tagFilter = state.filters.tag ?? "";

  // Apply circle filter coming from Dashboard navigation
  useEffect(() => {
    const circleFilter = (location.state as { circleFilter?: string } | null)?.circleFilter;
    if (circleFilter) {
      setFilter("circle", circleFilter);
      // Clear navigation state so back-navigation doesn't re-apply the filter
      window.history.replaceState({}, "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mut = usePersonMutations();

  const companyName = useMemo(() => {
    const m = new Map(companies.map((c) => [c.id, c.name] as const));
    return (id?: string | null) => (id ? m.get(id) ?? "" : "");
  }, [companies]);

  const filtered = useMemo(() => {
    return persons.filter((p) => {
      if (circleFilter && String(p.circleOfRelation ?? "") !== circleFilter)
        return false;
      if (tagFilter && !(personTagIds[p.id] ?? []).includes(tagFilter))
        return false;
      return true;
    });
  }, [persons, circleFilter, tagFilter, personTagIds]);

  const columns: Column<Person>[] = [
    {
      key: "name",
      header: t("person.full_name"),
      accessor: (p) => (
        <Link
          to={`/people/${p.id}`}
          className="font-medium text-slate-900 hover:text-sapphire-700"
        >
          {fullName(p)}
        </Link>
      ),
      searchValue: (p) => fullName(p),
      sortValue: (p) => `${p.lastName} ${p.firstName}`.toLowerCase(),
    },
    {
      key: "role",
      header: t("person.role"),
      accessor: (p) => p.role ?? "—",
      searchValue: (p) => p.role ?? "",
      sortValue: (p) => p.role ?? "",
    },
    {
      key: "email",
      header: t("person.professional_email"),
      accessor: (p) => p.professionalEmail ?? "—",
      searchValue: (p) => p.professionalEmail ?? "",
      sortValue: (p) => p.professionalEmail ?? "",
    },
    {
      key: "company",
      header: t("person.current_company"),
      accessor: (p) => companyName(p.currentCompanyId) || "—",
      searchValue: (p) => companyName(p.currentCompanyId),
      sortValue: (p) => companyName(p.currentCompanyId).toLowerCase(),
    },
    {
      key: "circle",
      header: t("person.circle_short"),
      accessor: (p) => p.circleOfRelation ?? "—",
      sortValue: (p) => p.circleOfRelation ?? 99,
      className: "w-20",
    },
    {
      key: "tags",
      header: t("tag.plural"),
      accessor: (p) => {
        const ids = personTagIds[p.id] ?? [];
        const tags = allTags.filter((tag) => ids.includes(tag.id));
        return <TagList tags={tags} />;
      },
      className: "w-48",
    },
  ];

  async function onSubmit(input: PersonInput) {
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
    await api.exportCsv("persons");
  }

  return (
    <>
      <PageHeader
        title={t("person.plural")}
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
          onRowClick={(p) => nav(`/people/${p.id}`)}
          sortKey={state.sortKey}
          sortDir={state.sortDir}
          onSortChange={setSort}
          filters={
            <>
              <select
                className="input max-w-[180px]"
                value={circleFilter}
                onChange={(e) => setFilter("circle", e.target.value)}
              >
                <option value="">
                  {t("common.all")} {t("person.circle_of_relation")}
                </option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {t("person.circle_short")} {n}
                  </option>
                ))}
              </select>
              <select
                className="input max-w-[180px]"
                value={tagFilter}
                onChange={(e) => setFilter("tag", e.target.value)}
              >
                <option value="">{t("common.all")} {t("tag.plural")}</option>
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </>
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
            ? `${t("common.edit")} — ${fullName(editTarget)}`
            : `${t("common.add")} ${t("person.singular")}`
        }
        size="lg"
      >
        <PersonForm
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
