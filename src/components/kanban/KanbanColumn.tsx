import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import clsx from "clsx";

import type { Action, Person } from "../../types";
import KanbanCard from "./KanbanCard";

interface Props {
  status: string;
  label: string;
  actions: Action[];
  personById: Map<string, Person>;
  onEdit: (a: Action) => void;
  onDelete: (a: Action) => void;
  accentClass: string; // border-top color
}

export default function KanbanColumn({
  status,
  label,
  actions,
  personById,
  onEdit,
  onDelete,
  accentClass,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className={clsx("mb-3 rounded-t-md border-t-4 bg-slate-50 px-3 py-2", accentClass)}>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {actions.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={clsx(
          "flex-1 space-y-2 rounded-b-md p-2 transition-colors min-h-[120px]",
          isOver ? "bg-sapphire-50 ring-1 ring-sapphire-200" : "bg-slate-50/60",
        )}
      >
        <SortableContext
          items={actions.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {actions.map((a) => (
            <KanbanCard
              key={a.id}
              action={a}
              personById={personById}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {actions.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400 select-none">—</p>
        )}
      </div>
    </div>
  );
}
