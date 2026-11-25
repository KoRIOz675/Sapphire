import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Company, CompanyInput } from "../../types";
import { COMPANY_SECTORS } from "../../types";
import { useCompanies, useProjects } from "../../hooks";

interface Props {
  initial?: Company;
  onSubmit: (input: CompanyInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const EMPTY: CompanyInput = {
  name: "",
  website: "",
  sector: "",
  size: "",
  numberOfEmployees: null,
  description: "",
  priority: null,
  parentCompanyId: null,
  projectIds: [],
};

export default function CompanyForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const { t } = useTranslation();
  const { data: companies = [] } = useCompanies();
  const { data: projects = [] } = useProjects();

  const [form, setForm] = useState<CompanyInput>(() =>
    initial
      ? {
          name: initial.name,
          website: initial.website ?? "",
          sector: initial.sector ?? "",
          size: initial.size ?? "",
          numberOfEmployees: initial.numberOfEmployees ?? null,
          description: initial.description ?? "",
          priority: initial.priority ?? null,
          parentCompanyId: initial.parentCompanyId ?? null,
          projectIds: initial.projectIds ?? [],
        }
      : EMPTY,
  );

  const up = <K extends keyof CompanyInput>(k: K, v: CompanyInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const otherCompanies = companies.filter((c) => c.id !== initial?.id);

  function toggleProject(id: string) {
    setForm((f) => ({
      ...f,
      projectIds: f.projectIds.includes(id)
        ? f.projectIds.filter((p) => p !== id)
        : [...f.projectIds, id],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      website: form.website || null,
      sector: form.sector || null,
      size: form.size || null,
      description: form.description || null,
    });
  }

  const sizes = [
    t("company.sizes.micro"),
    t("company.sizes.pme"),
    t("company.sizes.eti"),
    t("company.sizes.ge"),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">{t("company.name")} *</label>
        <input
          className="input"
          required
          value={form.name}
          onChange={(e) => up("name", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t("company.website")}</label>
          <input
            className="input"
            placeholder="https://…"
            value={form.website ?? ""}
            onChange={(e) => up("website", e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t("company.sector")}</label>
          <select
            className="input"
            value={form.sector ?? ""}
            onChange={(e) => up("sector", e.target.value)}
          >
            <option value="">—</option>
            {COMPANY_SECTORS.map((s) => (
              <option key={s} value={s}>
                {t(`company.sectors.${s.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">{t("company.size")}</label>
          <select
            className="input"
            value={form.size ?? ""}
            onChange={(e) => up("size", e.target.value)}
          >
            <option value="">—</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("company.number_of_employees")}</label>
          <input
            className="input"
            type="number"
            min={0}
            value={form.numberOfEmployees ?? ""}
            onChange={(e) =>
              up(
                "numberOfEmployees",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </div>
        <div>
          <label className="label">{t("company.priority")}</label>
          <select
            className="input"
            value={form.priority ?? ""}
            onChange={(e) =>
              up("priority", e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">{t("company.parent_company")}</label>
        <select
          className="input"
          value={form.parentCompanyId ?? ""}
          onChange={(e) => up("parentCompanyId", e.target.value || null)}
        >
          <option value="">—</option>
          {otherCompanies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {projects.length > 0 && (
        <div>
          <label className="label">{t("company.projects")}</label>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProject(p.id)}
                className={
                  form.projectIds.includes(p.id)
                    ? "rounded-full border border-sapphire-500 bg-sapphire-100 px-3 py-0.5 text-xs font-medium text-sapphire-700"
                    : "rounded-full border border-slate-300 px-3 py-0.5 text-xs text-slate-600 hover:border-sapphire-400"
                }
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">{t("company.description")}</label>
        <textarea
          className="input min-h-[90px]"
          value={form.description ?? ""}
          onChange={(e) => up("description", e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {t("common.save")}
        </button>
      </div>
    </form>
  );
}
