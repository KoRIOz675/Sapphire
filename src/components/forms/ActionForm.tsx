import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Action, ActionInput, ActionStatus } from "../../types";
import { DISCUSSION_TYPES } from "../../types";
import { usePersons } from "../../hooks";
import { fullName, isoToLocalInput, localInputToIso } from "../../utils";
import EntityPicker from "../EntityPicker";
import MarkdownEditor from "../MarkdownEditor";

interface Props {
  initial?: Action;
  onSubmit: (input: ActionInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const EMPTY_INPUT = (): ActionInput => ({
  title: "",
  status: "to do",
  preparation: "",
  conclusion: "",
  scheduledDate: new Date().toISOString(),
  completedDate: null,
  discussionType: "",
  toPersonIds: [],
});

export default function ActionForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const { t } = useTranslation();
  const { data: persons = [] } = usePersons();

  const [form, setForm] = useState<ActionInput>(() =>
    initial
      ? {
          title: initial.title,
          status: initial.status,
          preparation: initial.preparation ?? "",
          conclusion: initial.conclusion ?? "",
          scheduledDate: initial.scheduledDate,
          completedDate: initial.completedDate ?? null,
          discussionType: initial.discussionType ?? "",
          toPersonIds: initial.toPersonIds ?? [],
        }
      : EMPTY_INPUT(),
  );

  const up = <K extends keyof ActionInput>(k: K, v: ActionInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      preparation: form.preparation || null,
      conclusion: form.conclusion || null,
      discussionType: form.discussionType || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">{t("action.title")} *</label>
        <input
          className="input"
          required
          value={form.title}
          onChange={(e) => up("title", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">{t("action.status")}</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => up("status", e.target.value as ActionStatus)}
          >
            <option value="to do">{t("action.statuses.todo")}</option>
            <option value="in progress">{t("action.statuses.in_progress")}</option>
            <option value="done">{t("action.statuses.done")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("action.scheduled_date")} *</label>
          <input
            className="input mb-1"
            type="date"
            required
            value={isoToLocalInput(form.scheduledDate).split("T")[0] ?? ""}
            onChange={(e) => {
              const time = isoToLocalInput(form.scheduledDate).split("T")[1] ?? "00:00";
              up("scheduledDate", localInputToIso(`${e.target.value}T${time}`));
            }}
          />
          <input
            className="input"
            type="time"
            value={isoToLocalInput(form.scheduledDate).split("T")[1] ?? ""}
            onChange={(e) => {
              const date = isoToLocalInput(form.scheduledDate).split("T")[0] ?? "";
              if (date) up("scheduledDate", localInputToIso(`${date}T${e.target.value}`));
            }}
          />
        </div>
        <div>
          <label className="label">{t("action.completed_date")}</label>
          <input
            className="input mb-1"
            type="date"
            value={isoToLocalInput(form.completedDate).split("T")[0] ?? ""}
            onChange={(e) => {
              const time = isoToLocalInput(form.completedDate).split("T")[1] ?? "00:00";
              up("completedDate", e.target.value ? localInputToIso(`${e.target.value}T${time}`) : null);
            }}
          />
          <input
            className="input"
            type="time"
            value={isoToLocalInput(form.completedDate).split("T")[1] ?? ""}
            onChange={(e) => {
              const date = isoToLocalInput(form.completedDate).split("T")[0] ?? "";
              if (date) up("completedDate", localInputToIso(`${date}T${e.target.value}`));
            }}
          />
        </div>
      </div>

      <div>
        <label className="label">{t("action.discussion_type")}</label>
        <select
          className="input"
          value={form.discussionType ?? ""}
          onChange={(e) => up("discussionType", e.target.value)}
        >
          <option value="">—</option>
          {DISCUSSION_TYPES.map((d) => (
            <option key={d} value={d}>
              {t(`action.discussion_types.${d.toLowerCase().replace(/\s+/g, "_")}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">{t("action.to_persons")}</label>
        <EntityPicker
          options={persons.map((p) => ({ id: p.id, label: fullName(p) }))}
          value={form.toPersonIds}
          onChange={(ids) => up("toPersonIds", ids)}
        />
      </div>

      <div>
        <label className="label">{t("action.preparation")}</label>
        <MarkdownEditor
          value={form.preparation ?? ""}
          onChange={(html) => up("preparation", html)}
          placeholder={t("action.preparation")}
          minHeight="100px"
        />
      </div>

      <div>
        <label className="label">{t("action.conclusion")}</label>
        <MarkdownEditor
          value={form.conclusion ?? ""}
          onChange={(html) => up("conclusion", html)}
          placeholder={t("action.conclusion")}
          minHeight="100px"
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
