import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api/tauri";
import type {
  ActionInput,
  AttachmentEntityType,
  CompanyInput,
  CurrentUser,
  NoteInput,
  PersonInput,
  ProjectInput,
  TagInput,
} from "./types";

const CURRENT_USER_KEY = "current_user";
const EMPTY_USER: CurrentUser = { firstName: "", lastName: "", email: "" };

// -----------------------------------------------------------------------------
// Current CRM user
// -----------------------------------------------------------------------------
export const useCurrentUser = () =>
  useQuery({
    queryKey: ["current_user"],
    queryFn: async () => {
      const raw = await api.getSetting(CURRENT_USER_KEY);
      if (!raw) return EMPTY_USER;
      try {
        return { ...EMPTY_USER, ...(JSON.parse(raw) as CurrentUser) };
      } catch {
        return EMPTY_USER;
      }
    },
  });

// -----------------------------------------------------------------------------
// Persons
// -----------------------------------------------------------------------------
export const usePersons = () =>
  useQuery({ queryKey: ["persons"], queryFn: api.listPersons });

export const usePerson = (id: string | undefined) =>
  useQuery({
    queryKey: ["person", id],
    queryFn: () => api.getPerson(id!),
    enabled: !!id,
  });

export function usePersonMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["persons"] });
    qc.invalidateQueries({ queryKey: ["person"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["actions"] });
  };
  return {
    create: useMutation({
      mutationFn: (input: PersonInput) => api.createPerson(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: PersonInput }) =>
        api.updatePerson(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deletePerson(id),
      onSuccess: invalidate,
    }),
  };
}

// -----------------------------------------------------------------------------
// Companies
// -----------------------------------------------------------------------------
export const useCompanies = () =>
  useQuery({ queryKey: ["companies"], queryFn: api.listCompanies });

export const useCompany = (id: string | undefined) =>
  useQuery({
    queryKey: ["company", id],
    queryFn: () => api.getCompany(id!),
    enabled: !!id,
  });

export function useCompanyMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["company"] });
    qc.invalidateQueries({ queryKey: ["persons"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return {
    create: useMutation({
      mutationFn: (input: CompanyInput) => api.createCompany(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: CompanyInput }) =>
        api.updateCompany(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteCompany(id),
      onSuccess: invalidate,
    }),
  };
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------
export const useActions = () =>
  useQuery({ queryKey: ["actions"], queryFn: api.listActions });

export const useAction = (id: string | undefined) =>
  useQuery({
    queryKey: ["action", id],
    queryFn: () => api.getAction(id!),
    enabled: !!id,
  });

export function useActionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["actions"] });
    qc.invalidateQueries({ queryKey: ["action"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return {
    create: useMutation({
      mutationFn: (input: ActionInput) => api.createAction(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ActionInput }) =>
        api.updateAction(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteAction(id),
      onSuccess: invalidate,
    }),
  };
}

// -----------------------------------------------------------------------------
// Projects
// -----------------------------------------------------------------------------
export const useProjects = () =>
  useQuery({ queryKey: ["projects"], queryFn: api.listProjects });

export const useProject = (id: string | undefined) =>
  useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

export function useProjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project"] });
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return {
    create: useMutation({
      mutationFn: (input: ProjectInput) => api.createProject(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ProjectInput }) =>
        api.updateProject(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteProject(id),
      onSuccess: invalidate,
    }),
  };
}

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------
export const useDashboard = () =>
  useQuery({ queryKey: ["dashboard"], queryFn: api.dashboardStats });

// -----------------------------------------------------------------------------
// Tags
// -----------------------------------------------------------------------------
export const useTags = () =>
  useQuery({ queryKey: ["tags"], queryFn: api.listTags });

export const useAllPersonTagIds = () =>
  useQuery({
    queryKey: ["all-person-tag-ids"],
    queryFn: api.getAllPersonTagIds,
  });

export const useAllCompanyTagIds = () =>
  useQuery({
    queryKey: ["all-company-tag-ids"],
    queryFn: api.getAllCompanyTagIds,
  });

export const usePersonTags = (personId: string | undefined) =>
  useQuery({
    queryKey: ["person-tags", personId],
    queryFn: () => api.getPersonTags(personId!),
    enabled: !!personId,
  });

export const useCompanyTags = (companyId: string | undefined) =>
  useQuery({
    queryKey: ["company-tags", companyId],
    queryFn: () => api.getCompanyTags(companyId!),
    enabled: !!companyId,
  });

export function useTagMutations() {
  const qc = useQueryClient();
  const invalidateTags = () => qc.invalidateQueries({ queryKey: ["tags"] });
  return {
    create: useMutation({
      mutationFn: (input: TagInput) => api.createTag(input),
      onSuccess: invalidateTags,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: TagInput }) =>
        api.updateTag(id, input),
      onSuccess: invalidateTags,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteTag(id),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["tags"] });
        qc.invalidateQueries({ queryKey: ["person-tags"] });
        qc.invalidateQueries({ queryKey: ["company-tags"] });
        qc.invalidateQueries({ queryKey: ["all-person-tag-ids"] });
        qc.invalidateQueries({ queryKey: ["all-company-tag-ids"] });
      },
    }),
    setPersonTags: useMutation({
      mutationFn: ({ personId, tagIds }: { personId: string; tagIds: string[] }) =>
        api.setPersonTags(personId, tagIds),
      onSuccess: (_data: void, { personId }: { personId: string; tagIds: string[] }) => {
        qc.invalidateQueries({ queryKey: ["person-tags", personId] });
        qc.invalidateQueries({ queryKey: ["all-person-tag-ids"] });
      },
    }),
    setCompanyTags: useMutation({
      mutationFn: ({ companyId, tagIds }: { companyId: string; tagIds: string[] }) =>
        api.setCompanyTags(companyId, tagIds),
      onSuccess: (_data: void, { companyId }: { companyId: string; tagIds: string[] }) => {
        qc.invalidateQueries({ queryKey: ["company-tags", companyId] });
        qc.invalidateQueries({ queryKey: ["all-company-tag-ids"] });
      },
    }),
  };
}

// -----------------------------------------------------------------------------
// Notes
// -----------------------------------------------------------------------------
export const useNote = (
  entityType: "person" | "company" | "action" | "project" | undefined,
  entityId: string | undefined,
) =>
  useQuery({
    queryKey: ["note", entityType, entityId],
    queryFn: () => api.getNote(entityType!, entityId!),
    enabled: !!entityType && !!entityId,
  });

export function useNoteMutations() {
  const qc = useQueryClient();
  return {
    upsert: useMutation({
      mutationFn: (input: NoteInput) => api.upsertNote(input),
      onSuccess: (_data: unknown, input: NoteInput) => {
        qc.invalidateQueries({
          queryKey: ["note", input.entityType, input.entityId],
        });
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteNote(id),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["note"] }),
    }),
  };
}

// -----------------------------------------------------------------------------
// Search
// -----------------------------------------------------------------------------
export const useGlobalSearch = (query: string) =>
  useQuery({
    queryKey: ["search", query],
    queryFn: () => api.globalSearch(query),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });

// -----------------------------------------------------------------------------
// Attachments
// -----------------------------------------------------------------------------
export const useAttachments = (
  entityType: AttachmentEntityType | undefined,
  entityId: string | undefined,
) =>
  useQuery({
    queryKey: ["attachments", entityType, entityId],
    queryFn: () => api.listAttachments(entityType!, entityId!),
    enabled: !!entityType && !!entityId,
  });

export function useAttachmentMutations(
  entityType: AttachmentEntityType,
  entityId: string,
) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
  return {
    add: useMutation({
      mutationFn: () => api.addAttachment(entityType, entityId),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteAttachment(id),
      onSuccess: invalidate,
    }),
    open: (id: string) => api.openAttachment(id),
  };
}
