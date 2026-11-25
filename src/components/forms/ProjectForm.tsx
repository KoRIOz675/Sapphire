import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Project, ProjectInput, ProjectStatus } from "../../types";

interface Props {
  initial?: Project;
  onSubmit: (input: ProjectInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const EMPTY: ProjectInput = {
  name: "",
  description: "",
  status: "Active",
  companyIds: [],
};

export default function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const { t } = useTranslation();

  const [form, setForm] = useState<ProjectInput>(() =>
    initial
      ? {
          name: initial.name,
          description: initial.description ?? "",
          status: initial.status,
          companyIds: initial.companyIds ?? [],
        }
      : EMPTY,
  );

  const up = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      description: form.description || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">{t("project.name")} *</label>
        <input
          className="input"
          required
          value={form.name}
          onChange={(e) => up("name", e.target.value)}
        />
      </div>

      <div>
        <label className="label">{t("project.status")}</label>
        <select
          className="input"
          value={form.status}
          onChange={(e) => up("status", e.target.value as ProjectStatus)}
        >
          <option value="Active">{t("project.statuses.active")}</option>
          <option value="Inactive">{t("project.statuses.inactive")}</option>
        </select>
      </div>

      <div>
        <label className="label">{t("project.description")}</label>
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
