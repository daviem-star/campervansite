"use client";

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  getPrimaryDateForStop,
  getStopSubtitle,
  isStopOnDate,
  stopTypeLabel,
} from "@/lib/tripDerived";
import { TripStop } from "@/types/trip";

type StopTimelineProps = {
  stops: TripStop[];
  selectedDate: string;
  onEdit: (stop: TripStop) => void;
  onDelete: (stop: TripStop) => void;
  onReorder: (activeId: string, overId: string) => Promise<void>;
};

const typeStyle = {
  stay: "border-brand-support/35 bg-brand-support/18 text-brand-primary",
  ferry: "border-state-info-border bg-state-info-surface text-state-info",
  point_of_interest: "border-brand-secondary/35 bg-brand-secondary/16 text-brand-secondary-variant",
} as const;

function SortableStopItem({
  stop,
  selectedDate,
  onEdit,
  onDelete,
}: {
  stop: TripStop;
  selectedDate: string;
  onEdit: (stop: TripStop) => void;
  onDelete: (stop: TripStop) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOnSelectedDay = isStopOnDate(stop, selectedDate);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border bg-app-surface p-3 shadow-sm transition ${
        isDragging ? "border-brand-primary/40 shadow-lg" : "border-app-border"
      } ${isOnSelectedDay ? "ring-2 ring-brand-primary/20" : "opacity-80"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Drag ${stop.title}`}
            className="cursor-grab rounded-md border border-app-border px-2 py-1 text-xs text-app-muted active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            Drag
          </button>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
              typeStyle[stop.type]
            }`}
          >
            {stopTypeLabel(stop)}
          </span>
        </div>

        <span className="text-xs font-medium text-app-muted">{getPrimaryDateForStop(stop)}</span>
      </div>

      <h4 className="text-sm font-semibold text-app-text">{stop.title}</h4>
      <p className="mt-1 text-xs text-app-muted">{getStopSubtitle(stop)}</p>

      {stop.notes ? <p className="mt-2 text-xs text-app-muted">{stop.notes}</p> : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(stop)}
          className="planner-button-secondary rounded-lg border px-2.5 py-1 text-xs font-semibold transition"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(stop)}
          className="planner-button-danger rounded-lg border px-2.5 py-1 text-xs font-semibold transition"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export default function StopTimeline({
  stops,
  selectedDate,
  onEdit,
  onDelete,
  onReorder,
}: StopTimelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    await onReorder(String(active.id), String(over.id));
  };

  if (stops.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-app-border bg-app-surface px-4 py-8 text-center text-sm text-app-muted">
        No itinerary stops yet. Add your first stop to get started.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={stops.map((stop) => stop.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {stops.map((stop) => (
            <SortableStopItem
              key={stop.id}
              stop={stop}
              selectedDate={selectedDate}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
