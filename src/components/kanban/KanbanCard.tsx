import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "react-router-dom";
import { Pencil, Trash2, GripVertical } from "lucide-react";
import clsx from "clsx";

import type { Action, Person } from "../../types";
import Badge, { statusTone } from "../Badge";
import { fmtDay, fullName } from "../../utils";

interface Props {
  action: Action;
  personById: Map<string, Person>;
  onEdit: (a: Action) => void;
  onDelete: (a: Action) => void;
  overlay?: boolean; // true when rendered as DragOverlay ghost
}

export default function KanbanCard({ action: a, personById, onEdit, onDelete, overlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: a.id, data: { action: a } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const names = a.toPersonIds
    .map((id) => personById.get(id))
    .filter(Boolean)
    .map((p) => fullName(p!));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group rounded-lg border bg-white p-3 shadow-xs transition-shadow",
        isDragging && !overlay ? "opacity-40 shadow-none" : "hover:shadow-md",
        overlay && "rotate-1 shadow-lg cursor-grabbing",
      )}
    >
      {/* drag handle + title row */}
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          tabIndex={-1}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Link
          to={`/actions/${a.id}`}
          className="flex-1 text-sm font-medium text-slate-800 hover:text-sapphire-700 leading-snug"
        >
          {a.title}
        </Link>
      </div>

      {/* meta */}
      <div className="mt-2 ml-6 space-y-1">
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(a.status)}>{a.status}</Badge>
          <span className="text-xs text-slate-400">{fmtDay(a.scheduledDate)}</span>
        </div>
        {names.length > 0 && (
          <p className="text-xs text-slate-500 truncate">
            {names.slice(0, 2).join(", ")}
            {names.length > 2 && <span className="text-slate-400"> +{names.length - 2}</span>}
          </p>
        )}
      </div>

      {/* actions (visible on hover) */}
      <div className="mt-2 ml-6 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="btn-secondary px-1.5 py-0.5 text-xs"
          onClick={() => onEdit(a)}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          className="btn-danger px-1.5 py-0.5 text-xs"
          onClick={() => onDelete(a)}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
