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

const stopRowSelectedClass = "ring-2 ring-sky-300 border-sky-300 bg-sky-50/70";

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
          ? "border-sky-300 bg-sky-100 text-sky-900"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
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
        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
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
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {groupedByDate.map(([date, datePois]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                  className={`cursor-pointer rounded-xl border bg-white p-3 transition ${
                    exactSelected
                      ? stopRowSelectedClass
                      : daySelected
                        ? "border-sky-200 bg-sky-50/30"
                        : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                          <StopTypeIcon kind="point_of_interest" className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-semibold text-slate-900">{poi.title}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{poi.place.label}</p>
                      {poi.notes ? <p className="mt-1 text-xs text-slate-500">{poi.notes}</p> : null}
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
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
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
              className={`rounded-2xl border bg-white p-3 shadow-sm transition ${
                staySelected
                  ? stopRowSelectedClass
                  : daySelected
                    ? "border-sky-200 bg-sky-50/20"
                    : "border-slate-200"
              }`}
            >
              <div
                ref={registerItemRef(section.stay.id)}
                onClick={() => onSelectEntity({ kind: "stay", stopId: section.stay.id })}
                className="cursor-pointer rounded-xl border border-transparent p-1 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <StopTypeIcon kind="stay" className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{section.stay.title}</p>
                        <p className="text-xs text-slate-600">{section.stay.place.label}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{stayWindowLabel(section.stay)}</p>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {formatDateOnly(dateOnlyFromIso(section.stay.checkInAt))} -{" "}
                      {formatDateOnly(dateOnlyFromIso(section.stay.checkOutAt))}
                    </p>
                    {section.stay.notes ? (
                      <p className="mt-1 text-xs text-slate-500">{section.stay.notes}</p>
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
              className={`rounded-2xl border bg-white p-3 shadow-sm transition ${
                exactSelected
                  ? stopRowSelectedClass
                  : daySelected
                    ? "border-sky-200 bg-sky-50/20"
                    : "border-slate-200"
              }`}
            >
              <div
                ref={registerItemRef(section.ferry.id)}
                onClick={() => onSelectEntity({ kind: "ferry", stopId: section.ferry.id })}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
                        <StopTypeIcon kind="ferry" className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{section.ferry.title}</p>
                        <p className="text-xs text-slate-600">
                          {section.ferry.departurePort.label} to {section.ferry.arrivalPort.label}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{ferryWindowLabel(section.ferry)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Check-in by {formatDateTime(section.ferry.checkInBy)}
                    </p>
                    {section.ferry.notes ? (
                      <p className="mt-1 text-xs text-slate-500">{section.ferry.notes}</p>
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
            className={`rounded-2xl border bg-white p-3 shadow-sm transition ${
              exactSelected
                ? stopRowSelectedClass
                : daySelected
                  ? "border-sky-200 bg-sky-50/20"
                  : "border-slate-200"
            }`}
          >
            <div
              ref={registerItemRef(section.poi.id)}
              onClick={() => onSelectEntity({ kind: "point_of_interest", stopId: section.poi.id })}
              className="cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                      <StopTypeIcon kind="point_of_interest" className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{section.poi.title}</p>
                      <p className="text-xs text-slate-600">{section.poi.place.label}</p>
                    </div>
                  </div>
                  {section.poi.notes ? (
                    <p className="mt-2 text-xs text-slate-500">{section.poi.notes}</p>
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
