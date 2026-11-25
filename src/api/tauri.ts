import { invoke } from "@tauri-apps/api/core";
import type {
  Action,
  ActionInput,
  Attachment,
  AttachmentEntityType,
  BackupEntry,
  Company,
  CompanyInput,
  CsvEntity,
  DashboardStats,
  LinkedInImportSummary,
  Note,
  NoteEntityType,
  NoteInput,
  Person,
  PersonInput,
  Project,
  ProjectInput,
  SearchResult,
  Tag,
  TagInput,
} from "../types";

export const api = {
  // ---- Persons ----
  listPersons: () => invoke<Person[]>("list_persons"),
  getPerson: (id: string) => invoke<Person | null>("get_person", { id }),
  createPerson: (input: PersonInput) => invoke<Person>("create_person", { input }),
  updatePerson: (id: string, input: PersonInput) => invoke<Person>("update_person", { id, input }),
  deletePerson: (id: string) => invoke<void>("delete_person", { id }),

  // ---- Companies ----
  listCompanies: () => invoke<Company[]>("list_companies"),
  getCompany: (id: string) => invoke<Company | null>("get_company", { id }),
  createCompany: (input: CompanyInput) => invoke<Company>("create_company", { input }),
  updateCompany: (id: string, input: CompanyInput) => invoke<Company>("update_company", { id, input }),
  deleteCompany: (id: string) => invoke<void>("delete_company", { id }),

  // ---- Actions ----
  listActions: () => invoke<Action[]>("list_actions"),
  getAction: (id: string) => invoke<Action | null>("get_action", { id }),
  createAction: (input: ActionInput) => invoke<Action>("create_action", { input }),
  updateAction: (id: string, input: ActionInput) => invoke<Action>("update_action", { id, input }),
  deleteAction: (id: string) => invoke<void>("delete_action", { id }),

  // ---- Projects ----
  listProjects: () => invoke<Project[]>("list_projects"),
  getProject: (id: string) => invoke<Project | null>("get_project", { id }),
  createProject: (input: ProjectInput) => invoke<Project>("create_project", { input }),
  updateProject: (id: string, input: ProjectInput) => invoke<Project>("update_project", { id, input }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),

  // ---- Dashboard ----
  dashboardStats: () => invoke<DashboardStats>("dashboard_stats"),

  // ---- Import / export ----
  // Import/export and attachment commands open the file dialog themselves (in
  // Rust) and resolve to null / false when the user cancels it.
  exportCsv: (entity: CsvEntity) => invoke<string | null>("export_csv", { entity }),
  exportJson: () => invoke<string | null>("export_json"),
  importJson: (replace: boolean) => invoke<boolean>("import_json", { replace }),

  // ---- Settings ----
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  getDbPath: () => invoke<string>("get_db_path"),
  runBackupNow: () => invoke<string>("run_backup_now"),

  // ---- Tags ----
  listTags: () => invoke<Tag[]>("list_tags"),
  createTag: (input: TagInput) => invoke<Tag>("create_tag", { input }),
  updateTag: (id: string, input: TagInput) => invoke<Tag>("update_tag", { id, input }),
  deleteTag: (id: string) => invoke<void>("delete_tag", { id }),
  getPersonTags: (personId: string) => invoke<Tag[]>("get_person_tags", { personId }),
  setPersonTags: (personId: string, tagIds: string[]) => invoke<void>("set_person_tags", { personId, tagIds }),
  getCompanyTags: (companyId: string) => invoke<Tag[]>("get_company_tags", { companyId }),
  setCompanyTags: (companyId: string, tagIds: string[]) => invoke<void>("set_company_tags", { companyId, tagIds }),
  getAllPersonTagIds: () => invoke<Record<string, string[]>>("get_all_person_tag_ids"),
  getAllCompanyTagIds: () => invoke<Record<string, string[]>>("get_all_company_tag_ids"),

  // ---- Notes ----
  getNote: (entityType: NoteEntityType, entityId: string) => invoke<Note | null>("get_note", { entityType, entityId }),
  upsertNote: (input: NoteInput) => invoke<Note>("upsert_note", { input }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),

  // ---- Search ----
  globalSearch: (query: string) =>
    invoke<SearchResult[]>("global_search", { query }),

  // ---- Attachments ----
  listAttachments: (entityType: AttachmentEntityType, entityId: string) =>
    invoke<Attachment[]>("list_attachments", { entityType, entityId }),
  addAttachment: (entityType: AttachmentEntityType, entityId: string) =>
    invoke<Attachment | null>("add_attachment", { entityType, entityId }),
  deleteAttachment: (id: string) => invoke<void>("delete_attachment", { id }),
  openAttachment: (id: string) => invoke<void>("open_attachment", { id }),

  // ---- Reminders ----
  getReminderLeadTime: () =>
    invoke<string>("get_setting", { key: "reminder_lead_time_hours" }).then((v) => parseInt(v ?? "24", 10)),
  setReminderLeadTime: (hours: number) =>
    invoke<void>("set_setting", { key: "reminder_lead_time_hours", value: String(hours) }),

  // ---- Backups ----
  listBackups: () => invoke<BackupEntry[]>("list_backups"),
  restoreFromBackup: (path: string) => invoke<void>("restore_from_backup", { path }),

  // ---- LinkedIn import ----
  importLinkedInCsv: () => invoke<LinkedInImportSummary | null>("import_linkedin_csv"),

  // ---- Custom DB path ----
  getCustomDbPath: () => invoke<string | null>("get_custom_db_path"),
  // Both take effect at the next launch.
  chooseDbFolder: () => invoke<string | null>("choose_db_folder"),
  resetDbPath: () => invoke<void>("reset_db_path"),
};
