"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
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
  formatDateOnly,
  formatDateTime,
  formatDayChip,
  formatDayNumber,
  formatDurationMinutes,
} from "@/lib/date";
import { getPrimaryDateForStop } from "@/lib/tripDerived";
import { ItineraryDay, SelectedEntity, TripStop } from "@/types/trip";
import StopTypeIcon from "@/components/planner/StopTypeIcon";

type StopTimelineProps = {
  days: ItineraryDay[];
  selectedDate: string;
  selectedEntity: SelectedEntity;
  isVisible: boolean;
  routeStatus: "fresh" | "stale" | "unavailable";
  canMutate?: boolean;
  isOfflineReadOnly?: boolean;
  onSelectDate: (date: string) => void;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onView: (stop: TripStop) => void;
  onEdit: (stop: TripStop) => void;
  onDelete: (stop: TripStop) => void;
  onReorder: (activeId: string, overId: string) => Promise<void>;
  onMove: (stopId: string, offset: -1 | 1) => void;
};

const stopToneClass = {
  stay: "border-brand-support/35 bg-brand-support/18 text-brand-primary",
  ferry: "border-state-info-border bg-state-info-surface text-state-info",
  point_of_interest:
    "border-brand-secondary/35 bg-brand-secondary/16 text-brand-secondary-variant",
} as const;

const scrollItemWithinContainer = (element: HTMLElement | null) => {
  if (!element) {
    return;
  }

  const container = element.closest("[data-itinerary-scroll-container='true']");

  if (!(container instanceof HTMLElement)) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const targetTop =
    container.scrollTop +
    (elementRect.top - containerRect.top) -
    container.clientHeight / 2 +
    elementRect.height / 2;

  container.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
};

const getStopLocationLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return stop.place.label;
  }

  if (stop.type === "ferry") {
    return `${stop.departurePort.label} to ${stop.arrivalPort.label}`;
  }

  return stop.place.label;
};

const getStopScheduleLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return `Check-in ${formatDateTime(stop.checkInAt)} · Check-out ${formatDateTime(
      stop.checkOutAt,
    )}`;
  }

  if (stop.type === "ferry") {
    return `Departs ${formatDateTime(stop.departureAt)} · Check-in by ${formatDateTime(
      stop.checkInBy,
    )}`;
  }

  return `Visit on ${formatDateOnly(stop.visitDate)}`;
};

function SortableStopCard({
  stop,
  selectedDate,
  selectedEntity,
  canMutate = false,
  isOfflineReadOnly = false,
  canMoveUp,
  canMoveDown,
  onSelectEntity,
  onView,
  onEdit,
  onDelete,
  onMove,
  registerItemRef,
}: {
  stop: TripStop;
  selectedDate: string;
  selectedEntity: SelectedEntity;
  canMutate?: boolean;
  isOfflineReadOnly?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onView: (stop: TripStop) => void;
  onEdit: (stop: TripStop) => void;
  onDelete: (stop: TripStop) => void;
  onMove: (stopId: string, offset: -1 | 1) => void;
  registerItemRef: (key: string) => (element: HTMLElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
    disabled: !canMutate,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const exactSelected = selectedEntity?.stopId === stop.id;
  const daySelected = getPrimaryDateForStop(stop) === selectedDate;

  return (
    <article
      ref={(element) => {
        setNodeRef(element);
        registerItemRef(stop.id)(element);
      }}
      style={style}
      className={`rounded-[24px] border bg-app-surface p-4 shadow-[0_12px_28px_rgb(var(--color-app-overlay)_/_0.06)] transition ${
        exactSelected
          ? "planner-selected"
          : daySelected
            ? "border-brand-primary/18 bg-app-surface"
            : "border-app-border"
      } ${isDragging ? "shadow-[0_18px_38px_rgb(var(--color-app-overlay)_/_0.12)]" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${stopToneClass[stop.type]}`}
        >
          <StopTypeIcon kind={stop.type} className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="planner-eyebrow text-app-muted">
              {stop.type === "stay" ? "Stay" : stop.type === "ferry" ? "Ferry" : "Point of interest"}
            </span>
            <span className="planner-meta text-app-muted">{formatDateOnly(getPrimaryDateForStop(stop))}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onSelectEntity({ kind: stop.type, stopId: stop.id });
              onView(stop);
            }}
            className="mt-2 w-full text-left"
          >
            <h4 className="planner-title-lg text-app-text">{stop.title}</h4>
            <p className="planner-copy mt-2 text-app-muted">{getStopLocationLabel(stop)}</p>
            <p className="planner-copy-sm mt-2 text-app-muted">{getStopScheduleLabel(stop)}</p>
          </button>
        </div>

        <div
          className="flex shrink-0 flex-col items-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          {canMutate ? (
            <>
              <button
                type="button"
                aria-label={`Reorder ${stop.title}`}
                className="hidden cursor-grab rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-muted active:cursor-grabbing lg:inline-flex"
                {...attributes}
                {...listeners}
              >
                Drag
              </button>

              <div className="flex gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => onMove(stop.id, -1)}
                  disabled={!canMoveUp}
                  className="planner-button-secondary rounded-full border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => onMove(stop.id, 1)}
                  disabled={!canMoveDown}
                  className="planner-button-secondary rounded-full border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Down
                </button>
              </div>
            </>
          ) : (
            <div className="hidden lg:block" aria-hidden="true" />
          )}

          {isOfflineReadOnly ? (
            <span className="tone-warning rounded-full border px-2.5 py-1 text-xs font-semibold">
              Offline
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => onView(stop)}
            className="planner-button-primary rounded-full border px-3 py-1.5 text-xs font-semibold"
          >
            View
          </button>

          {canMutate ? (
            <button
              type="button"
              onClick={() => onEdit(stop)}
              disabled={isOfflineReadOnly}
              className="planner-button-secondary rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Edit
            </button>
          ) : null}

          {canMutate ? (
            <button
              type="button"
              onClick={() => onDelete(stop)}
              className="planner-button-danger rounded-full border px-3 py-1.5 text-xs font-semibold"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function StopTimeline({
  days,
  selectedDate,
  selectedEntity,
  isVisible,
  routeStatus,
  canMutate = false,
  isOfflineReadOnly = false,
  onSelectDate,
  onSelectEntity,
  onView,
  onEdit,
  onDelete,
  onReorder,
  onMove,
}: StopTimelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const dayRefs = useRef<Record<string, HTMLElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const stopOrder = useMemo(
    () =>
      days.flatMap((day) =>
        day.rows.flatMap((row) => (row.kind === "stop" ? [row.stop.id] : [])),
      ),
    [days],
  );
  const visibleDays = useMemo(
    () => days.filter((day) => day.rows.length > 0 || day.date === selectedDate),
    [days, selectedDate],
  );

  const registerDayRef = (key: string) => (element: HTMLElement | null) => {
    dayRefs.current[key] = element;
  };

  const registerItemRef = (key: string) => (element: HTMLElement | null) => {
    itemRefs.current[key] = element;
  };

  useEffect(() => {
    if (!isVisible || days.length === 0) {
      return;
    }

    const targetDay = dayRefs.current[selectedDate] ?? dayRefs.current[visibleDays[0]?.date ?? ""];
    scrollItemWithinContainer(targetDay);
  }, [days.length, isVisible, selectedDate, visibleDays]);

  useEffect(() => {
    if (!isVisible || !selectedEntity) {
      return;
    }

    scrollItemWithinContainer(itemRefs.current[selectedEntity.stopId]);
  }, [isVisible, selectedEntity]);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    await onReorder(String(active.id), String(over.id));
  };

  if (days.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-app-border bg-app-surface px-4 py-8 text-center">
        <p className="planner-copy text-app-muted">
          Add stays, ferries, and points of interest to start shaping the route.
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={stopOrder} strategy={verticalListSortingStrategy}>
        <div className="space-y-6">
          {visibleDays.map((day) => {
            const isBaseOnlyDay = day.rows.length === 0;

            return (
              <section
                key={day.date}
                ref={registerDayRef(day.date)}
                className={`rounded-[28px] border px-4 transition sm:px-5 ${
                  isBaseOnlyDay ? "py-3 sm:py-3.5" : "py-4 sm:py-5"
                } ${
                  day.date === selectedDate
                    ? "border-brand-primary/20 bg-brand-primary/5"
                    : "border-app-border bg-app-surface/65"
                }`}
              >
                <div
                  className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${
                    isBaseOnlyDay ? "" : "border-b border-app-border/70 pb-4"
                  }`}
                >
                  <div className="min-w-0">
                    <button type="button" onClick={() => onSelectDate(day.date)} className="text-left">
                      <p className="planner-eyebrow planner-section-label">Day {formatDayNumber(day.date)}</p>
                      <h3 className="planner-title-lg mt-2 text-app-text">
                        {formatDayChip(day.date)} · {formatDateOnly(day.date)}
                      </h3>
                    </button>
                    <p className="planner-copy mt-2 text-app-muted">
                      {day.activeStay
                        ? `Base: ${day.activeStay.title}`
                        : "No overnight base assigned to this day yet."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
                      {day.stopCount} stop{day.stopCount === 1 ? "" : "s"}
                    </span>
                    <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
                      {day.roadLegCount} road leg{day.roadLegCount === 1 ? "" : "s"}
                    </span>
                    {routeStatus === "fresh" && day.roadLegCount > 0 ? (
                      <span className="rounded-full border border-brand-support/35 bg-brand-support/18 px-3 py-1 text-xs font-semibold text-brand-primary">
                        Live
                      </span>
                    ) : null}
                    {routeStatus === "stale" && day.roadLegCount > 0 ? (
                      <span className="tone-warning rounded-full border px-3 py-1 text-xs font-semibold">
                        Needs refresh
                      </span>
                    ) : null}
                    {routeStatus === "unavailable" && day.roadLegCount > 0 ? (
                      <span className="tone-error rounded-full border px-3 py-1 text-xs font-semibold">
                        Unavailable
                      </span>
                    ) : null}
                  </div>
                </div>

                {day.rows.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {day.rows.map((row) =>
                      row.kind === "travel" ? (
                        <article
                          key={row.id}
                          className="rounded-[22px] border border-dashed border-app-border bg-app-surface-muted/55 px-4 py-3.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="planner-eyebrow text-app-muted">Travel leg</p>
                              <p className="planner-copy mt-2 text-app-text">
                                {row.fromLabel} to {row.toLabel}
                              </p>
                            </div>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                row.estimate && routeStatus === "fresh"
                                  ? "tone-success"
                                  : "tone-warning"
                              }`}
                            >
                              {row.estimate && routeStatus === "fresh"
                                ? formatDurationMinutes(row.estimate.durationMinutes)
                                : "Needs refresh"}
                            </span>
                          </div>

                          {row.estimate ? (
                            <p className="planner-copy-sm mt-2 text-app-muted">
                              {row.estimate.distanceKm.toFixed(1)} km
                            </p>
                          ) : (
                            <p className="planner-copy-sm mt-2 text-app-muted">
                              Refresh the route to calculate this leg.
                            </p>
                          )}
                        </article>
                      ) : (
                        <SortableStopCard
                          key={row.id}
                          stop={row.stop}
                          selectedDate={selectedDate}
                          selectedEntity={selectedEntity}
                          canMutate={canMutate}
                          isOfflineReadOnly={isOfflineReadOnly}
                          canMoveUp={stopOrder.indexOf(row.stop.id) > 0}
                          canMoveDown={stopOrder.indexOf(row.stop.id) < stopOrder.length - 1}
                          onSelectEntity={onSelectEntity}
                          onView={onView}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onMove={onMove}
                          registerItemRef={registerItemRef}
                        />
                      ),
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
