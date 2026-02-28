"use client";

import { useEffect, useMemo, useRef } from "react";

import { dateOnlyFromIso, formatDateChipShort, formatDateOnly, formatDateTime, formatDayChip } from "@/lib/date";
import { ferryWindowLabel, sectionMatchesDate, stayWindowLabel } from "@/lib/tripDerived";
import {
  ItinerarySection,
  PointOfInterestStop,
  SelectedEntity,
  TripStop,
} from "@/types/trip";
import StopTypeIcon from "@/components/planner/StopTypeIcon";

type ItinerarySectionsProps = {
  sections: ItinerarySection[];
  selectedDate: string;
  selectedEntity: SelectedEntity;
  isVisible: boolean;
  onSelectDate: (date: string) => void;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onEdit: (stop: TripStop) => void;
  onDelete: (stop: TripStop) => void;
};

const dayChipClass =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition";

const stopRowSelectedClass = "ring-2 ring-ui-accent/70 border-ui-accent bg-ui-accent-strong/35";

function DateChip({
  date,
  active,
  onClick,
}: {
  date: string;
  active: boolean;
  onClick: (date: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick(date);
      }}
      className={`${dayChipClass} ${
        active
          ? "border-ui-accent bg-ui-accent-strong text-white"
          : "border-ui-border bg-ui-surface text-slate-300 hover:bg-ui-chrome-soft"
      }`}
      title={formatDateOnly(date)}
    >
      <span>{formatDateChipShort(date)}</span>
      <span className="uppercase text-[10px] tracking-[0.08em]">{formatDayChip(date)}</span>
    </button>
  );
}

function ItemActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg border border-ui-border-soft bg-ui-surface px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-ui-chrome-soft"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg border border-rose-500/50 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15"
      >
        Delete
      </button>
    </div>
  );
}

function PoiRows({
  pois,
  selectedDate,
  selectedEntity,
  onSelectDate,
  onSelectEntity,
  onEdit,
  onDelete,
  registerItemRef,
}: {
  pois: PointOfInterestStop[];
  selectedDate: string;
  selectedEntity: SelectedEntity;
  onSelectDate: (date: string) => void;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onEdit: (stop: TripStop) => void;
  onDelete: (stop: TripStop) => void;
  registerItemRef: (key: string) => (element: HTMLElement | null) => void;
}) {
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, PointOfInterestStop[]>();
    pois.forEach((poi) => {
      const list = groups.get(poi.visitDate) ?? [];
      list.push(poi);
      groups.set(poi.visitDate, list);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pois]);

  if (pois.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-ui-border bg-ui-surface-alt p-3">
      {groupedByDate.map(([date, datePois]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Points of interest
            </p>
            <DateChip date={date} active={selectedDate === date} onClick={onSelectDate} />
          </div>

          <div className="space-y-2">
            {datePois.map((poi) => {
              const exactSelected =
                selectedEntity?.kind === "point_of_interest" && selectedEntity.stopId === poi.id;
              const daySelected = selectedDate === poi.visitDate;

              return (
                <div
                  key={poi.id}
                  ref={registerItemRef(poi.id)}
                  onClick={() => onSelectEntity({ kind: "point_of_interest", stopId: poi.id })}
                  className={`cursor-pointer rounded-xl border bg-ui-raised p-3 transition ${
                    exactSelected
                      ? stopRowSelectedClass
                      : daySelected
                        ? "border-ui-accent/70 bg-ui-accent-strong/25"
                        : "border-ui-border hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/20 text-orange-300">
                          <StopTypeIcon kind="point_of_interest" className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-semibold text-slate-100">{poi.title}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{poi.place.label}</p>
                      {poi.notes ? <p className="mt-1 text-xs text-slate-400">{poi.notes}</p> : null}
                    </div>

                    <ItemActions onEdit={() => onEdit(poi)} onDelete={() => onDelete(poi)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ItinerarySections({
  sections,
  selectedDate,
  selectedEntity,
  isVisible,
  onSelectDate,
  onSelectEntity,
  onEdit,
  onDelete,
}: ItinerarySectionsProps) {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});

  const registerSectionRef = (key: string) => (element: HTMLElement | null) => {
    sectionRefs.current[key] = element;
  };

  const registerItemRef = (key: string) => (element: HTMLElement | null) => {
    itemRefs.current[key] = element;
  };

  useEffect(() => {
    if (!isVisible || sections.length === 0) {
      return;
    }

    const targetSection = sections.find((section) => sectionMatchesDate(section, selectedDate));
    if (!targetSection) {
      return;
    }

    const element = sectionRefs.current[targetSection.id];
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isVisible, selectedDate, sections]);

  useEffect(() => {
    if (!isVisible || !selectedEntity) {
      return;
    }

    const itemElement = itemRefs.current[selectedEntity.stopId];
    itemElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isVisible, selectedEntity]);

  if (sections.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ui-border bg-ui-surface px-4 py-8 text-center text-sm text-slate-400">
        No itinerary sections yet. Add a campsite, ferry, or POI to start planning.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const daySelected = sectionMatchesDate(section, selectedDate);

        if (section.kind === "stay_group") {
          const staySelected = selectedEntity?.kind === "stay" && selectedEntity.stopId === section.stay.id;

          return (
            <section
              key={section.id}
              ref={registerSectionRef(section.id)}
              className={`rounded-2xl border bg-ui-raised p-3 shadow-sm transition ${
                staySelected
                  ? stopRowSelectedClass
                  : daySelected
                    ? "border-ui-accent/70 bg-ui-accent-strong/25"
                    : "border-ui-border"
              }`}
            >
              <div
                ref={registerItemRef(section.stay.id)}
                onClick={() => onSelectEntity({ kind: "stay", stopId: section.stay.id })}
                className="cursor-pointer rounded-xl border border-transparent p-1 transition hover:bg-ui-chrome-soft/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                        <StopTypeIcon kind="stay" className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{section.stay.title}</p>
                        <p className="text-xs text-slate-300">{section.stay.place.label}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{stayWindowLabel(section.stay)}</p>
                    <p className="mt-1 text-xs font-medium text-slate-300">
                      {formatDateOnly(dateOnlyFromIso(section.stay.checkInAt))} -{" "}
                      {formatDateOnly(dateOnlyFromIso(section.stay.checkOutAt))}
                    </p>
                    {section.stay.notes ? (
                      <p className="mt-1 text-xs text-slate-400">{section.stay.notes}</p>
                    ) : null}
                  </div>

                  <ItemActions onEdit={() => onEdit(section.stay)} onDelete={() => onDelete(section.stay)} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {section.dates.map((date) => (
                  <DateChip key={`${section.id}-${date}`} date={date} active={selectedDate === date} onClick={onSelectDate} />
                ))}
              </div>

              <PoiRows
                pois={section.pois}
                selectedDate={selectedDate}
                selectedEntity={selectedEntity}
                onSelectDate={onSelectDate}
                onSelectEntity={onSelectEntity}
                onEdit={onEdit}
                onDelete={onDelete}
                registerItemRef={registerItemRef}
              />
            </section>
          );
        }

        if (section.kind === "ferry") {
          const exactSelected = selectedEntity?.kind === "ferry" && selectedEntity.stopId === section.ferry.id;
          return (
            <section
              key={section.id}
              ref={registerSectionRef(section.id)}
              className={`rounded-2xl border bg-ui-raised p-3 shadow-sm transition ${
                exactSelected
                  ? stopRowSelectedClass
                  : daySelected
                    ? "border-ui-accent/70 bg-ui-accent-strong/25"
                    : "border-ui-border"
              }`}
            >
              <div
                ref={registerItemRef(section.ferry.id)}
                onClick={() => onSelectEntity({ kind: "ferry", stopId: section.ferry.id })}
                className="cursor-pointer rounded-xl border border-transparent p-1 transition hover:bg-ui-chrome-soft/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                        <StopTypeIcon kind="ferry" className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{section.ferry.title}</p>
                        <p className="text-xs text-slate-300">
                          {section.ferry.departurePort.label} to {section.ferry.arrivalPort.label}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{ferryWindowLabel(section.ferry)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Check-in by {formatDateTime(section.ferry.checkInBy)}
                    </p>
                    {section.ferry.notes ? (
                      <p className="mt-1 text-xs text-slate-400">{section.ferry.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <DateChip
                      date={section.primaryDate}
                      active={selectedDate === section.primaryDate}
                      onClick={onSelectDate}
                    />
                    <ItemActions
                      onEdit={() => onEdit(section.ferry)}
                      onDelete={() => onDelete(section.ferry)}
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        }

        const exactSelected =
          selectedEntity?.kind === "point_of_interest" && selectedEntity.stopId === section.poi.id;

        return (
          <section
            key={section.id}
            ref={registerSectionRef(section.id)}
            className={`rounded-2xl border bg-ui-raised p-3 shadow-sm transition ${
              exactSelected
                ? stopRowSelectedClass
                : daySelected
                  ? "border-ui-accent/70 bg-ui-accent-strong/25"
                  : "border-ui-border"
            }`}
          >
            <div
              ref={registerItemRef(section.poi.id)}
              onClick={() => onSelectEntity({ kind: "point_of_interest", stopId: section.poi.id })}
              className="cursor-pointer rounded-xl border border-transparent p-1 transition hover:bg-ui-chrome-soft/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-orange-300">
                      <StopTypeIcon kind="point_of_interest" className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{section.poi.title}</p>
                      <p className="text-xs text-slate-300">{section.poi.place.label}</p>
                    </div>
                  </div>
                  {section.poi.notes ? (
                    <p className="mt-2 text-xs text-slate-400">{section.poi.notes}</p>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <DateChip date={section.poi.visitDate} active={selectedDate === section.poi.visitDate} onClick={onSelectDate} />
                  <ItemActions onEdit={() => onEdit(section.poi)} onDelete={() => onDelete(section.poi)} />
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
