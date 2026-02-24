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
  stay: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ferry: "border-cyan-200 bg-cyan-50 text-cyan-700",
  point_of_interest: "border-orange-200 bg-orange-50 text-orange-700",
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
      className={`rounded-2xl border bg-white p-3 shadow-sm transition ${
        isDragging ? "border-slate-400 shadow-lg" : "border-slate-200"
      } ${isOnSelectedDay ? "ring-2 ring-sky-200" : "opacity-80"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Drag ${stop.title}`}
            className="cursor-grab rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 active:cursor-grabbing"
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

        <span className="text-xs font-medium text-slate-500">{getPrimaryDateForStop(stop)}</span>
      </div>

      <h4 className="text-sm font-semibold text-slate-900">{stop.title}</h4>
      <p className="mt-1 text-xs text-slate-600">{getStopSubtitle(stop)}</p>

      {stop.notes ? <p className="mt-2 text-xs text-slate-500">{stop.notes}</p> : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(stop)}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(stop)}
          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
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
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
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
