import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Person, PersonInput } from "../../types";
import { useCompanies, usePersons } from "../../hooks";
import EntityPicker from "../EntityPicker";
import { fullName } from "../../utils";

interface Props {
  initial?: Person;
  onSubmit: (input: PersonInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const EMPTY: PersonInput = {
  firstName: "",
  lastName: "",
  department: "",
  role: "",
  mobilePhone: "",
  professionalEmail: "",
  otherEmails: [],
  additionalInformation: "",
  circleOfRelation: null,
  birthday: null,
  currentCompanyId: null,
  primarySourceId: null,
  directManagerId: null,
  secondarySourceIds: [],
};

export default function PersonForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const { t } = useTranslation();
  const { data: companies = [] } = useCompanies();
  const { data: persons = [] } = usePersons();

  const [form, setForm] = useState<PersonInput>(() =>
    initial
      ? {
          firstName: initial.firstName,
          lastName: initial.lastName,
          department: initial.department ?? "",
          role: initial.role ?? "",
          mobilePhone: initial.mobilePhone ?? "",
          professionalEmail: initial.professionalEmail ?? "",
          otherEmails: initial.otherEmails ?? [],
          additionalInformation: initial.additionalInformation ?? "",
          circleOfRelation: initial.circleOfRelation ?? null,
          birthday: initial.birthday ?? null,
          currentCompanyId: initial.currentCompanyId ?? null,
          primarySourceId: initial.primarySourceId ?? null,
          directManagerId: initial.directManagerId ?? null,
          secondarySourceIds: initial.secondarySourceIds ?? [],
        }
      : EMPTY,
  );

  const up = <K extends keyof PersonInput>(k: K, v: PersonInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const otherPersons = persons.filter((p) => p.id !== initial?.id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      department: form.department || null,
      role: form.role || null,
      mobilePhone: form.mobilePhone || null,
      professionalEmail: form.professionalEmail || null,
      additionalInformation: form.additionalInformation || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t("person.first_name")} *</label>
          <input
            className="input"
            required
            value={form.firstName}
            onChange={(e) => up("firstName", e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t("person.last_name")} *</label>
          <input
            className="input"
            required
            value={form.lastName}
            onChange={(e) => up("lastName", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t("person.department")}</label>
          <input
            className="input"
            value={form.department ?? ""}
            onChange={(e) => up("department", e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t("person.role")}</label>
          <input
            className="input"
            value={form.role ?? ""}
            onChange={(e) => up("role", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t("person.mobile_phone")}</label>
          <input
            className="input"
            value={form.mobilePhone ?? ""}
            onChange={(e) => up("mobilePhone", e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t("person.professional_email")}</label>
          <input
            type="email"
            className="input"
            value={form.professionalEmail ?? ""}
            onChange={(e) => up("professionalEmail", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">
          {t("person.other_emails")}{" "}
          <span className="text-xs text-slate-500">
            ({t("person.other_emails_hint")})
          </span>
        </label>
        <textarea
          className="input min-h-[70px]"
          value={form.otherEmails.join("\n")}
          onChange={(e) =>
            up(
              "otherEmails",
              e.target.value
                .split(/\n+/)
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t("person.circle_of_relation")}</label>
          <select
            className="input"
            value={form.circleOfRelation ?? ""}
            onChange={(e) =>
              up(
                "circleOfRelation",
                e.target.value ? Number(e.target.value) : null,
              )
            }
          >
            <option value="">—</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </div>
        <div>
          <label className="label">{t("person.birthday")}</label>
          <input
            type="date"
            className="input"
            value={form.birthday ?? ""}
            onChange={(e) => up("birthday", e.target.value || null)}
          />
        </div>
      </div>

      <div>
        <label className="label">{t("person.current_company")}</label>
        <select
          className="input"
          value={form.currentCompanyId ?? ""}
          onChange={(e) =>
            up("currentCompanyId", e.target.value || null)
          }
        >
          <option value="">—</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t("person.primary_source")}</label>
          <select
            className="input"
            value={form.primarySourceId ?? ""}
            onChange={(e) => up("primarySourceId", e.target.value || null)}
          >
            <option value="">—</option>
            {otherPersons.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("person.direct_manager")}</label>
          <select
            className="input"
            value={form.directManagerId ?? ""}
            onChange={(e) => up("directManagerId", e.target.value || null)}
          >
            <option value="">—</option>
            {otherPersons.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">{t("person.secondary_sources")}</label>
        <EntityPicker
          options={otherPersons.map((p) => ({ id: p.id, label: fullName(p) }))}
          value={form.secondarySourceIds}
          onChange={(ids) => up("secondarySourceIds", ids)}
          placeholder={t("common.search")}
        />
      </div>

      <div>
        <label className="label">{t("person.additional_information")}</label>
        <textarea
          className="input min-h-[90px]"
          value={form.additionalInformation ?? ""}
          onChange={(e) => up("additionalInformation", e.target.value)}
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
