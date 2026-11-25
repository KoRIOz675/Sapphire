// Types TS miroirs des structs Rust (camelCase via serde rename_all).

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  department?: string | null;
  role?: string | null;
  mobilePhone?: string | null;
  professionalEmail?: string | null;
  otherEmails: string[];
  additionalInformation?: string | null;
  circleOfRelation?: number | null;
  birthday?: string | null;
  currentCompanyId?: string | null;
  primarySourceId?: string | null;
  directManagerId?: string | null;
  secondarySourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  department?: string | null;
  role?: string | null;
  mobilePhone?: string | null;
  professionalEmail?: string | null;
  otherEmails: string[];
  additionalInformation?: string | null;
  circleOfRelation?: number | null;
  birthday?: string | null;
  currentCompanyId?: string | null;
  primarySourceId?: string | null;
  directManagerId?: string | null;
  secondarySourceIds: string[];
}

export type CompanySize = "Micro-entreprise" | "PME" | "ETI" | "Grande entreprise";

export const COMPANY_SECTORS = [
  "Agroalimentaire",
  "Association",
  "Audit",
  "Bank",
  "BTP",
  "Consulting",
  "Cybersecurity",
  "Defense",
  "Education",
  "Energie",
  "ESN",
  "Gouvernementale",
  "Hotellerie",
  "Immobilier",
  "Industry",
  "JeuVideo",
  "Jobboard",
  "Juridique",
  "Laboratoire",
  "Luxe",
  "Media",
  "Medical",
  "Outplacement",
  "Outsourcing",
  "Recherche",
  "Retail",
  "Telecom",
  "Tourisme",
  "Transport",
  "Other",
] as const;
export type CompanySector = (typeof COMPANY_SECTORS)[number];

export interface Company {
  id: string;
  name: string;
  website?: string | null;
  sector?: string | null;
  size?: string | null;
  numberOfEmployees?: number | null;
  description?: string | null;
  priority?: number | null;
  parentCompanyId?: string | null;
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyInput {
  name: string;
  website?: string | null;
  sector?: string | null;
  size?: string | null;
  numberOfEmployees?: number | null;
  description?: string | null;
  priority?: number | null;
  parentCompanyId?: string | null;
  projectIds: string[];
}

export interface BackupEntry {
  name: string;
  path: string;
  sizeBytes: number;
  modified: string;
}

export interface LinkedInImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  companiesCreated: number;
}

export type ActionStatus = "to do" | "in progress" | "done";

export const DISCUSSION_TYPES = [
  "SMS",
  "Phone Call",
  "Voice mail",
  "Email",
  "LinkedIn",
  "meeting",
  "Other",
] as const;
export type DiscussionType = (typeof DISCUSSION_TYPES)[number];

export interface Action {
  id: string;
  title: string;
  status: ActionStatus;
  preparation?: string | null;
  conclusion?: string | null;
  scheduledDate: string;
  completedDate?: string | null;
  discussionType?: string | null;
  toPersonIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ActionInput {
  title: string;
  status: ActionStatus;
  preparation?: string | null;
  conclusion?: string | null;
  scheduledDate: string;
  completedDate?: string | null;
  discussionType?: string | null;
  toPersonIds: string[];
}

// Project status is a fixed enum.
export type ProjectStatus = "Active" | "Inactive";

// Profil de l'utilisateur du CRM (toujours l'initiateur des actions).
// Stored in the `settings` table under the `current_user` key (JSON).
export interface CurrentUser {
  firstName: string;
  lastName: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  companyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  status: ProjectStatus;
  companyIds: string[];
}

export interface DashboardStats {
  personsCount: number;
  companiesCount: number;
  actionsCount: number;
  projectsCount: number;
  circleCounts: [number, number, number, number];
  overdueActions: Action[];
  upcomingActions: Action[];
  staleContactsCount: number;
  overdueActionsCount: number;
}

export type CsvEntity = "persons" | "companies" | "actions" | "projects";

// ── Tags ────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  createdAt: string;
}

export interface TagInput {
  name: string;
  color?: string | null;
}

// ── Notes ───────────────────────────────────────────────────────────────────

export type NoteEntityType = "person" | "company" | "action" | "project";

export interface Note {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  entityType: NoteEntityType;
  entityId: string;
  content: string;
}

// ── Attachments ─────────────────────────────────────────────────────────────

export type AttachmentEntityType = "person" | "company" | "action" | "project";

export interface Attachment {
  id: string;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  storedPath: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  entityType: string; // "person" | "company" | "action" | "project"
  title: string;
  subtitle?: string | null;
}

