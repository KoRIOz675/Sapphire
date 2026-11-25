import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useTranslation } from "react-i18next";

import type { Action, ActionInput, Person } from "../../types";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";

type Status = "to do" | "in progress" | "done";

interface Props {
  actions: Action[];
  personById: Map<string, Person>;
  onStatusChange: (action: Action, newStatus: Status) => Promise<void>;
  onEdit: (a: Action) => void;
  onDelete: (a: Action) => void;
}

const COLUMNS: { status: Status; labelKey: string; accent: string }[] = [
  { status: "to do",       labelKey: "action.statuses.todo",        accent: "border-amber-400" },
  { status: "in progress", labelKey: "action.statuses.in_progress",  accent: "border-blue-400"  },
  { status: "done",        labelKey: "action.statuses.done",         accent: "border-green-400" },
];

export default function KanbanBoard({ actions, personById, onStatusChange, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const [activeAction, setActiveAction] = useState<Action | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function byStatus(status: Status) {
    return actions.filter((a) => a.status === status);
  }

  function handleDragStart(event: DragStartEvent) {
    const action = event.active.data.current?.action as Action | undefined;
    setActiveAction(action ?? null);
  }

  function handleDragOver(_event: DragOverEvent) {
    // Visual feedback is handled by useDroppable's isOver in KanbanColumn
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveAction(null);
    const { active, over } = event;
    if (!over) return;

    const action = active.data.current?.action as Action | undefined;
    if (!action) return;

    // `over.id` is either a column status string or a card id
    // Resolve the target status
    let targetStatus: Status | null = null;
    const validStatuses: Status[] = ["to do", "in progress", "done"];

    if (validStatuses.includes(over.id as Status)) {
      // Dropped on a column drop zone
      targetStatus = over.id as Status;
    } else {
      // Dropped on another card — find which column that card belongs to
      const targetAction = actions.find((a) => a.id === over.id);
      if (targetAction && validStatuses.includes(targetAction.status as Status)) {
        targetStatus = targetAction.status as Status;
      }
    }

    if (!targetStatus || targetStatus === action.status) return;

    await onStatusChange(action, targetStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-3 gap-4 h-full">
        {COLUMNS.map(({ status, labelKey, accent }) => (
          <KanbanColumn
            key={status}
            status={status}
            label={t(labelKey)}
            actions={byStatus(status)}
            personById={personById}
            onEdit={onEdit}
            onDelete={onDelete}
            accentClass={accent}
          />
        ))}
      </div>

      <DragOverlay>
        {activeAction && (
          <KanbanCard
            action={activeAction}
            personById={personById}
            onEdit={onEdit}
            onDelete={onDelete}
            overlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
