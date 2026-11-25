import { ExternalLink, Paperclip, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAttachments, useAttachmentMutations } from "../hooks";
import type { AttachmentEntityType } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  entityType: AttachmentEntityType;
  entityId: string;
}

export default function AttachmentsSection({ entityType, entityId }: Props) {
  const { t } = useTranslation();
  const { data: attachments = [], isLoading } = useAttachments(entityType, entityId);
  const mut = useAttachmentMutations(entityType, entityId);

  async function handleAdd() {
    await mut.add.mutateAsync();
  }

  return (
    <section className="card md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Paperclip className="h-4 w-4" />
          {t("attachment.plural")}
        </h3>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={handleAdd}
          disabled={mut.add.isPending}
          title={t("attachment.add")}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("attachment.add")}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">{t("common.loading")}</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-slate-400">{t("attachment.empty")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2">
              {/* File icon / mime hint */}
              <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />

              {/* Name + metadata */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {a.fileName}
                </p>
                <p className="text-xs text-slate-400">
                  {[a.mimeType, fmtSize(a.sizeBytes)].filter(Boolean).join(" · ")}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="btn-secondary px-2 py-1 text-xs"
                  title={t("attachment.open")}
                  onClick={() => mut.open(a.id)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="btn-danger px-2 py-1 text-xs"
                  title={t("common.delete")}
                  disabled={mut.remove.isPending}
                  onClick={() => mut.remove.mutate(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
