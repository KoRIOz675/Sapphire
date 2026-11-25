import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";

import PageHeader from "../components/PageHeader";
import DataTable, { Column } from "../components/DataTable";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import CompanyForm from "../components/forms/CompanyForm";
import {
  useAllCompanyTagIds,
  useCompanies,
  useCompanyMutations,
  useTags,
} from "../hooks";
import type { Company, CompanyInput } from "../types";
import { COMPANY_SECTORS } from "../types";
import { api } from "../api/tauri";
import { TagList } from "../components/TagInput";
import { usePersistedTableState } from "../hooks/usePersistedTableState";
import { useRegisterCreateHandler } from "../context/ShortcutContext";
import { safeHttpUrl } from "../url";

export default function CompanyList() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data: companies = [], isLoading } = useCompanies();
  const mut = useCompanyMutations();
  const { data: allTags = [] } = useTags();
  const { data: companyTagIds = {} } = useAllCompanyTagIds();

  const [modalOpen, setModalOpen] = useState(false);
  useRegisterCreateHandler(() => { setEditTarget(undefined); setModalOpen(true); });
  const [editTarget, setEditTarget] = useState<Company | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Company | undefined>();

  const { state, setFilter, setSort } = usePersistedTableState("companies", {
    sortKey: null,
    sortDir: "asc",
    filters: { size: "", priority: "", sector: "", tag: "" },
  });
  const sizeFilter = state.filters.size ?? "";
  const priorityFilter = state.filters.priority ?? "";
  const sectorFilter = state.filters.sector ?? "";
  const tagFilter = state.filters.tag ?? "";

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (sizeFilter && c.size !== sizeFilter) return false;
      if (priorityFilter && String(c.priority ?? "") !== priorityFilter) return false;
      if (sectorFilter && c.sector !== sectorFilter) return false;
      if (tagFilter && !(companyTagIds[c.id] ?? []).includes(tagFilter)) return false;
      return true;
    });
  }, [companies, sizeFilter, priorityFilter, sectorFilter, tagFilter, companyTagIds]);

  const sectorLabel = (s: string | null | undefined) =>
    s ? t(`company.sectors.${s.toLowerCase()}`, { defaultValue: s }) : "—";

  const columns: Column<Company>[] = [
    {
      key: "name",
      header: t("company.name"),
      accessor: (c) => (
        <Link
          to={`/company/${c.id}`}
          className="font-medium text-slate-900 hover:text-sapphire-700"
        >
          {c.name}
        </Link>
      ),
      searchValue: (c) => c.name,
      sortValue: (c) => c.name.toLowerCase(),
    },
    {
      key: "sector",
      header: t("company.sector"),
      accessor: (c) => sectorLabel(c.sector),
      searchValue: (c) => sectorLabel(c.sector),
      sortValue: (c) => sectorLabel(c.sector).toLowerCase(),
    },
    {
      key: "size",
      header: t("company.size"),
      accessor: (c) => c.size ?? "—",
      sortValue: (c) => c.size ?? "",
    },
    {
      key: "priority",
      header: t("company.priority"),
      accessor: (c) => c.priority ?? "—",
      sortValue: (c) => c.priority ?? 99,
      className: "w-20",
    },
    {
      key: "tags",
      header: t("tag.plural"),
      accessor: (c) => {
        const ids = companyTagIds[c.id] ?? [];
        const tags = allTags.filter((tag) => ids.includes(tag.id));
        return <TagList tags={tags} />;
      },
      className: "w-48",
    },
    {
      key: "website",
      header: t("company.website"),
      accessor: (c) =>
        c.website ? (
          <a
            href={safeHttpUrl(c.website)}
            className="text-sapphire-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.website}
          </a>
        ) : (
          "—"
        ),
      searchValue: (c) => c.website ?? "",
    },
  ];

  async function onSubmit(input: CompanyInput) {
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
    await api.exportCsv("companies");
  }

  return (
    <>
      <PageHeader
        title={t("company.plural")}
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
          onRowClick={(c) => nav(`/company/${c.id}`)}
          sortKey={state.sortKey}
          sortDir={state.sortDir}
          onSortChange={setSort}
          filters={
            <>
              <select
                className="input max-w-[180px]"
                value={sizeFilter}
                onChange={(e) => setFilter("size", e.target.value)}
              >
                <option value="">
                  {t("common.all")} {t("company.size")}
                </option>
                {[
                  t("company.sizes.micro"),
                  t("company.sizes.pme"),
                  t("company.sizes.eti"),
                  t("company.sizes.ge"),
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="input max-w-[160px]"
                value={priorityFilter}
                onChange={(e) => setFilter("priority", e.target.value)}
              >
                <option value="">
                  {t("common.all")} {t("company.priority")}
                </option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                className="input max-w-[200px]"
                value={sectorFilter}
                onChange={(e) => setFilter("sector", e.target.value)}
              >
                <option value="">
                  {t("common.all")} {t("company.sector")}
                </option>
                {COMPANY_SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {sectorLabel(s)}
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
          actions={(c) => (
            <div className="flex items-center justify-end gap-1">
              <button
                className="btn-secondary px-2 py-1"
                onClick={() => {
                  setEditTarget(c);
                  setModalOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                className="btn-danger px-2 py-1"
                onClick={() => setDeleteTarget(c)}
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
            : `${t("common.add")} ${t("company.singular")}`
        }
        size="lg"
      >
        <CompanyForm
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
