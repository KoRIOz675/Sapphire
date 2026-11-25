import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import {
  DatabaseBackup,
  FolderOpen,
  RefreshCcw,
  Upload,
  User,
  Bell,
  Database,
  Info,
  RotateCcw,
  UserPlus,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import { api } from "../api/tauri";
import { useCurrentUser } from "../hooks";
import { AUTO_CHECK_KEY, checkForUpdate, openReleasesPage, type UpdateStatus } from "../api/updates";
import type { BackupEntry, CurrentUser, LinkedInImportSummary } from "../types";

const BACKUP_KEEP_KEY = "backup_keep";
const SHOW_OVERDUE_KEY = "dashboard_show_overdue";
const SHOW_STALE_KEY = "dashboard_show_stale_contacts";

// ── Main Settings page ────────────────────────────────────────────────────────

export default function Settings() {
  const { t } = useTranslation();

  const [dbPath, setDbPath] = useState("");
  const [customDbPath, setCustomDbPath] = useState("");
  const [customDbPathSaved, setCustomDbPathSaved] = useState(false);
  const [backupKeep, setBackupKeep] = useState("10");
  const [showOverdue, setShowOverdue] = useState(true);
  const [showStale, setShowStale] = useState(true);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  // Backup list
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupsLoaded, setBackupsLoaded] = useState(false);

  // LinkedIn import
  const [linkedInSummary, setLinkedInSummary] = useState<LinkedInImportSummary | null>(null);

  // Reminder
  const [reminderLeadTime, setReminderLeadTime] = useState("24");

  // About / updater
  const [appVersion, setAppVersion] = useState("");
  const [updateCheck, setUpdateCheck] = useState<UpdateStatus | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [autoCheck, setAutoCheck] = useState(false);

  // User profile (local only)
  const qc = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [profile, setProfile] = useState<CurrentUser>({ firstName: "", lastName: "", email: "" });
  useEffect(() => {
    if (currentUser) setProfile(currentUser);
  }, [currentUser]);

  useEffect(() => {
    (async () => {
      setDbPath(await api.getDbPath());
      setCustomDbPath((await api.getCustomDbPath()) ?? "");
      setBackupKeep((await api.getSetting(BACKUP_KEEP_KEY)) ?? "10");
      setShowOverdue((await api.getSetting(SHOW_OVERDUE_KEY)) !== "false");
      setShowStale((await api.getSetting(SHOW_STALE_KEY)) !== "false");
      const leadTime = await api.getReminderLeadTime();
      setReminderLeadTime(String(leadTime));
      setAppVersion(await getVersion());
      setAutoCheck((await api.getSetting(AUTO_CHECK_KEY)) === "true");
    })();
  }, []);

  async function handleCheckForUpdate() {
    setCheckingUpdate(true);
    try {
      setUpdateCheck(await checkForUpdate());
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function toggleAutoCheck() {
    const next = !autoCheck;
    setAutoCheck(next);
    await api.setSetting(AUTO_CHECK_KEY, String(next));
  }

  async function saveProfile() {
    const trimmed: CurrentUser = {
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      email: profile.email.trim(),
    };
    await api.setSetting("current_user", JSON.stringify(trimmed));
    await qc.invalidateQueries({ queryKey: ["current_user"] });
    flash(t("settings.ok_saved"));
  }

  function flash(msg: string, error = false) {
    setToast({ message: msg, error });
    setTimeout(() => setToast(null), error ? 8000 : 3500);
  }

  function flashError(e: unknown) {
    flash(t("settings.action_failed", { message: String(e) }), true);
  }

  async function saveBackupSettings() {
    await api.setSetting(BACKUP_KEEP_KEY, backupKeep);
    flash(t("settings.ok_saved"));
  }

  async function toggleShowOverdue() {
    const next = !showOverdue;
    setShowOverdue(next);
    await api.setSetting(SHOW_OVERDUE_KEY, String(next));
  }

  async function toggleShowStale() {
    const next = !showStale;
    setShowStale(next);
    await api.setSetting(SHOW_STALE_KEY, String(next));
  }

  async function saveReminderSettings() {
    const hours = Math.max(1, parseInt(reminderLeadTime, 10) || 24);
    await api.setReminderLeadTime(hours);
    setReminderLeadTime(String(hours));
    flash(t("settings.ok_saved"));
  }

  async function chooseDbFolder() {
    let chosen: string | null;
    try {
      chosen = await api.chooseDbFolder();
    } catch (e) {
      flashError(e);
      return;
    }
    if (!chosen) return;
    setCustomDbPath(chosen);
    setCustomDbPathSaved(true);
    flash(t("settings.db_copied"));
  }

  async function resetDbPath() {
    try {
      await api.resetDbPath();
    } catch (e) {
      flashError(e);
      return;
    }
    setCustomDbPath("");
    setCustomDbPathSaved(true);
    flash(t("settings.ok_saved"));
  }

  async function runBackup() {
    const path = await api.runBackupNow();
    flash(t("settings.backup_done", { path }));
    if (backupsLoaded) setBackups(await api.listBackups());
  }

  async function toggleBackupsVisible() {
    if (backupsLoaded) {
      setBackupsLoaded(false);
      return;
    }
    setBackups(await api.listBackups());
    setBackupsLoaded(true);
  }

  async function handleRestore(entry: BackupEntry) {
    if (!confirm(t("settings.backup_restore_confirm", { name: entry.name }))) return;
    try {
      await api.restoreFromBackup(entry.path);
    } catch (e) {
      flashError(e);
      return;
    }
    // The restore replaced every table in place: refetch everything.
    await qc.invalidateQueries();
    setBackups(await api.listBackups());
    flash(t("settings.backup_restored"));
  }

  async function handleExportJson() {
    try {
      if (await api.exportJson()) flash(t("settings.ok_saved"));
    } catch (e) {
      flashError(e);
    }
  }

  async function handleImportJson() {
    try {
      if (!(await api.importJson(replaceOnImport))) return;
    } catch (e) {
      flashError(e);
      return;
    }
    await qc.invalidateQueries();
    flash(t("settings.import_done"));
  }

  async function handleLinkedInImport() {
    let summary: LinkedInImportSummary | null;
    try {
      summary = await api.importLinkedInCsv();
    } catch (e) {
      flashError(e);
      return;
    }
    if (!summary) return;
    setLinkedInSummary(summary);
    await qc.invalidateQueries();
    flash(t("settings.linkedin_import_done"));
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <>
      <PageHeader title={t("settings.title")} />

      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={
            toast.error
              ? "mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              : "mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          }
        >
          {toast.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* DB path */}
        <section className="card">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settings.db_path")}
          </h3>
          <code className="block break-all rounded-sm bg-slate-50 px-2 py-1 text-xs">
            {dbPath || "…"}
          </code>
        </section>

        {/* User profile (stored locally in the settings table) */}
        <section className="card md:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <User className="h-4 w-4" />
            {t("settings.user_section")}
          </h3>
          <p className="mb-3 text-xs text-slate-500">{t("settings.user_hint")}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">{t("settings.user_first_name")}</label>
              <input
                className="input"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("settings.user_last_name")}</label>
              <input
                className="input"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("settings.user_email")}</label>
              <input
                type="email"
                className="input"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3">
            <button className="btn-primary" onClick={saveProfile}>
              {t("common.save")}
            </button>
          </div>
        </section>

        {/* Dashboard preferences */}
        <section className="card md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settings.dashboard_prefs_section")}
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOverdue}
                onChange={toggleShowOverdue}
                className="accent-sapphire-600"
              />
              {t("settings.show_overdue_actions_card")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showStale}
                onChange={toggleShowStale}
                className="accent-sapphire-600"
              />
              {t("settings.show_stale_contacts_card")}
            </label>
          </div>
        </section>

        {/* Reminders */}
        <section className="card md:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Bell className="h-4 w-4" />
            {t("settings.reminder_section")}
          </h3>
          <div className="mb-3">
            <label className="label">{t("settings.reminder_lead_time")}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                className="input max-w-[120px]"
                value={reminderLeadTime}
                onChange={(e) => setReminderLeadTime(e.target.value)}
              />
              <span className="text-sm text-slate-500">{t("settings.reminder_lead_time_unit")}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t("settings.reminder_lead_time_hint")}</p>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={saveReminderSettings}>
              {t("common.save")}
            </button>
          </div>
        </section>

        {/* Database location */}
        <section className="card md:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Database className="h-4 w-4" />
            {t("settings.db_location_section")}
          </h3>
          <p className="mb-1 text-xs text-slate-500">
            {t("settings.db_path")}:{" "}
            <code className="rounded-sm bg-slate-50 px-1 py-0.5 text-xs">{dbPath || "…"}</code>
          </p>
          <div className="mb-3 mt-3">
            <label className="label">{t("settings.custom_db_path")}</label>
            <p className="mb-2 text-xs">
              <code className="rounded-sm bg-slate-50 px-1 py-0.5 text-xs">
                {customDbPath || t("settings.default_location")}
              </code>
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={chooseDbFolder}>
                <FolderOpen className="h-4 w-4" />
                {t("settings.choose_folder")}
              </button>
              {customDbPath && (
                <button className="btn-secondary" onClick={resetDbPath}>
                  {t("settings.use_default_location")}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">{t("settings.custom_db_path_hint")}</p>
          </div>
          {customDbPathSaved && (
            <p className="mb-2 text-xs font-medium text-amber-600">
              ⚠ {t("settings.restart_required")}
            </p>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("settings.backup_section")}
            </h4>
            <div className="mb-3">
              <label className="label">{t("settings.backup_keep")}</label>
              <input
                type="number"
                min={1}
                max={500}
                className="input max-w-[120px]"
                value={backupKeep}
                onChange={(e) => setBackupKeep(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={saveBackupSettings}>
                {t("common.save")}
              </button>
              <button className="btn-secondary" onClick={runBackup}>
                <DatabaseBackup className="h-4 w-4" />
                {t("settings.run_backup_now")}
              </button>
              <button className="btn-secondary" onClick={toggleBackupsVisible}>
                <RefreshCcw className="h-4 w-4" />
                {backupsLoaded ? t("settings.backup_list_hide") : t("settings.backup_list_load")}
              </button>
            </div>

            {backupsLoaded && (
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t("settings.backup_list_title")}
                </h4>
                {backups.length === 0 ? (
                  <p className="text-sm text-slate-400">{t("common.empty")}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {backups.map((b) => (
                      <li key={b.path} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{b.name}</p>
                          <p className="text-xs text-slate-400">
                            {b.modified} — {fmtSize(b.sizeBytes)}
                          </p>
                        </div>
                        <button
                          className="btn-secondary"
                          onClick={() => handleRestore(b)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t("settings.backup_restore")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>

        {/* LinkedIn import */}
        <section className="card md:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <UserPlus className="h-4 w-4" />
            {t("settings.linkedin_section")}
          </h3>
          <p className="mb-3 text-xs text-slate-500">{t("settings.linkedin_hint")}</p>
          <button className="btn-secondary" onClick={handleLinkedInImport}>
            <Upload className="h-4 w-4" />
            {t("settings.linkedin_import")}
          </button>
          {linkedInSummary && (
            <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <p className="font-medium">{t("settings.linkedin_import_done")}</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                <li>{t("settings.linkedin_total", { n: linkedInSummary.total })}</li>
                <li>{t("settings.linkedin_created", { n: linkedInSummary.created })}</li>
                <li>{t("settings.linkedin_updated", { n: linkedInSummary.updated })}</li>
                <li>{t("settings.linkedin_skipped", { n: linkedInSummary.skipped })}</li>
                <li>{t("settings.linkedin_companies_created", { n: linkedInSummary.companiesCreated })}</li>
              </ul>
            </div>
          )}
        </section>

        {/* Data (JSON export/import) */}
        <section className="card md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settings.data_section")}
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-secondary" onClick={handleExportJson}>
              <RefreshCcw className="h-4 w-4" />
              {t("common.export_json")}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={replaceOnImport}
                onChange={(e) => setReplaceOnImport(e.target.checked)}
                className="accent-sapphire-600"
              />
              {t("settings.import_replace")}
            </label>
            <button className="btn-primary" onClick={handleImportJson}>
              <Upload className="h-4 w-4" />
              {t("common.import_json")}
            </button>
          </div>
        </section>

        {/* About */}
        <section className="card md:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Info className="h-4 w-4" />
            {t("settings.about_section")}
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
            <div>
              <dt className="text-xs uppercase text-slate-400">{t("settings.about_version")}</dt>
              <dd className="font-medium text-slate-800">{appVersion || "…"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">{t("settings.about_made_by")}</dt>
              <dd className="font-medium text-slate-800">NBI-Project</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">{t("settings.about_contact")}</dt>
              <dd className="font-medium text-slate-800">contact@nbi-project.fr</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">{t("settings.about_license")}</dt>
              <dd className="font-medium text-slate-800">Apache-2.0</dd>
            </div>
          </dl>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoCheck}
              onChange={toggleAutoCheck}
              className="accent-sapphire-600"
            />
            {t("updater.auto_check")}
          </label>
          <p className="mt-1 text-xs text-slate-500">{t("updater.auto_check_hint")}</p>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-secondary" onClick={handleCheckForUpdate} disabled={checkingUpdate}>
              <RefreshCcw className={`h-4 w-4 ${checkingUpdate ? "animate-spin" : ""}`} />
              {checkingUpdate ? t("updater.checking") : t("updater.check_now")}
            </button>
            {updateCheck && !checkingUpdate && (
              <span className="text-sm text-slate-500">
                {updateCheck.status === "available" ? (
                  <>
                    {t("updater.available", { version: updateCheck.version })}{" "}
                    <button
                      type="button"
                      className="text-sapphire-600 underline"
                      onClick={() => void openReleasesPage()}
                    >
                      {t("updater.download")}
                    </button>
                  </>
                ) : updateCheck.status === "up_to_date"
                    ? t("updater.up_to_date")
                    : updateCheck.status === "no_release"
                      ? t("updater.no_release")
                      : t("updater.error", { message: updateCheck.message })}
              </span>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
