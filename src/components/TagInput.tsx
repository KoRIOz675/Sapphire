import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Tag as TagIcon } from "lucide-react";
import clsx from "clsx";
import type { Tag } from "../types";

// Palette of default colors for new tags
const COLOR_PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#ef4444", // red
  "#14b8a6", // teal
];

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

interface Props {
  /** All tags that exist in the DB */
  allTags: Tag[];
  /** IDs of currently selected tags */
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Called when the user creates a brand-new tag (name + auto-picked color) */
  onCreateTag: (name: string, color: string) => Promise<Tag>;
  disabled?: boolean;
}

export default function TagInput({
  allTags,
  selectedIds,
  onChange,
  onCreateTag,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = allTags.filter((t) => selectedIds.includes(t.id));

  const suggestions = allTags.filter(
    (tag) =>
      !selectedIds.includes(tag.id) &&
      tag.name.toLowerCase().includes(query.toLowerCase()),
  );

  const canCreate =
    query.trim().length > 0 &&
    !allTags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function removeTag(id: string) {
    onChange(selectedIds.filter((s) => s !== id));
  }

  function addTag(id: string) {
    onChange([...selectedIds, id]);
    setQuery("");
    inputRef.current?.focus();
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const tag = await onCreateTag(name, pickColor(name));
      onChange([...selectedIds, tag.id]);
      setQuery("");
    } finally {
      setCreating(false);
    }
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags + input */}
      <div
        className={clsx(
          "input flex min-h-[38px] flex-wrap items-center gap-1 cursor-text",
          disabled && "opacity-50 pointer-events-none",
        )}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selected.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            onRemove={() => removeTag(tag.id)}
          />
        ))}
        <input
          ref={inputRef}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-hidden"
          placeholder={selected.length === 0 ? t("tag.search_or_create") : ""}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions.length > 0) addTag(suggestions[0].id);
              else if (canCreate) handleCreate();
            }
            if (e.key === "Backspace" && query === "" && selected.length > 0) {
              removeTag(selected[selected.length - 1].id);
            }
          }}
          disabled={disabled}
        />
      </div>

      {/* Dropdown */}
      {open && (suggestions.length > 0 || canCreate) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-sapphire-200 bg-white shadow-lg">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-sapphire-50"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(tag.id);
              }}
            >
              <TagIcon
                className="h-3 w-3 shrink-0"
                style={{ color: tag.color ?? "#6366f1" }}
              />
              <span>{tag.name}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-sapphire-100 px-3 py-2 text-sm text-sapphire-700 hover:bg-sapphire-50"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              disabled={creating}
            >
              <Plus className="h-3 w-3" />
              {t("tag.create")} &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tag badge (with remove button) ───────────────────────────────────────────

export function TagBadge({
  tag,
  onRemove,
}: {
  tag: Tag;
  onRemove?: () => void;
}) {
  const color = tag.color ?? "#6366f1";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          className="ml-0.5 rounded-full hover:opacity-75"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

// ── Read-only tag list ────────────────────────────────────────────────────────

export function TagList({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
    </div>
  );
}
