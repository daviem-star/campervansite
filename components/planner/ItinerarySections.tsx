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
  canMutate?: boolean;
  isOfflineReadOnly?: boolean;
  onSelectDate: (date: string) => void;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onEdit: (stop: TripStop) => void;
  onDelete: (stop: TripStop) => void;
};

const dayChipClass =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition";

const stopRowSelectedClass = "planner-selected";

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
          ? "planner-pill-active"
          : "border-app-border bg-app-surface text-app-muted hover:border-brand-primary/18 hover:bg-app-surface-muted"
      }`}
      title={formatDateOnly(date)}
    >
      <span>{formatDateChipShort(date)}</span>
      <span className="uppercase text-[10px] tracking-[0.08em]">{formatDayChip(date)}</span>
    </button>
  );
}

function ItemActions({
  canMutate = false,
  isOfflineReadOnly = false,
  onEdit,
  onDelete,
}: {
  canMutate?: boolean;
  isOfflineReadOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (isOfflineReadOnly) {
    return (
      <span className="tone-warning rounded-lg border px-2.5 py-1 text-xs font-semibold">
        Offline read-only
      </span>
    );
  }

  if (!canMutate) {
    return null;
  }

  return (
    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={onEdit}
        className="planner-button-secondary rounded-lg border px-2.5 py-1 text-xs font-semibold transition"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="planner-button-danger rounded-lg border px-2.5 py-1 text-xs font-semibold transition"
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
  canMutate = false,
  isOfflineReadOnly = false,
}: {
  pois: PointOfInterestStop[];
  selectedDate: string;
  selectedEntity: SelectedEntity;
  onSelectDate: (date: string) => void;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onEdit: (stop: TripStop) => void;
  onDelete: (stop: TripStop) => void;
  registerItemRef: (key: string) => (element: HTMLElement | null) => void;
  canMutate?: boolean;
  isOfflineReadOnly?: boolean;
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
    <div className="mt-3 space-y-3 rounded-[22px] border border-app-border bg-app-surface-muted/80 p-3">
      {groupedByDate.map(([date, datePois]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="planner-eyebrow text-app-muted">Points of interest</p>
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
                  className={`cursor-pointer rounded-xl border bg-app-surface p-3 transition ${
                    exactSelected
                      ? stopRowSelectedClass
                      : daySelected
                        ? "planner-selected-soft"
                        : "border-app-border hover:border-brand-primary/18"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-secondary/16 text-brand-secondary-variant">
                          <StopTypeIcon kind="point_of_interest" className="h-4 w-4" />
                        </span>
                        <p className="planner-title-sm text-app-text">{poi.title}</p>
                      </div>
                      <p className="planner-meta mt-1 text-app-muted">{poi.place.label}</p>
                      {poi.notes ? <p className="planner-meta mt-1 text-app-muted">{poi.notes}</p> : null}
                    </div>

                    <ItemActions
                      canMutate={canMutate}
                      isOfflineReadOnly={isOfflineReadOnly}
                      onEdit={() => onEdit(poi)}
                      onDelete={() => onDelete(poi)}
                    />
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
  canMutate = false,
  isOfflineReadOnly = false,
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
    scrollItemWithinContainer(element);
  }, [isVisible, selectedDate, sections]);

  useEffect(() => {
    if (!isVisible || !selectedEntity) {
      return;
    }

    const itemElement = itemRefs.current[selectedEntity.stopId];
    scrollItemWithinContainer(itemElement);
  }, [isVisible, selectedEntity]);

  if (sections.length === 0) {
    return (
      <div className="planner-copy rounded-[24px] border border-dashed border-app-border bg-app-surface px-4 py-8 text-center text-app-muted">
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
              className={`rounded-[24px] border bg-app-surface-muted/65 p-4 transition ${
                staySelected
                  ? stopRowSelectedClass
                  : daySelected
                    ? "planner-selected-soft"
                    : "border-app-border"
              }`}
            >
              <div
                ref={registerItemRef(section.stay.id)}
                onClick={() => onSelectEntity({ kind: "stay", stopId: section.stay.id })}
                className="cursor-pointer rounded-2xl border border-transparent p-1 transition hover:bg-app-surface/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-support/18 text-brand-primary">
                        <StopTypeIcon kind="stay" className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="planner-title-sm text-app-text">{section.stay.title}</p>
                        <p className="planner-meta text-app-muted">{section.stay.place.label}</p>
                      </div>
                    </div>
                    <p className="planner-meta mt-2 text-app-muted">
                      {stayWindowLabel(section.stay)}
                    </p>
                    <p className="planner-copy-sm mt-1 font-medium text-app-muted">
                      {formatDateOnly(dateOnlyFromIso(section.stay.checkInAt))} -{" "}
                      {formatDateOnly(dateOnlyFromIso(section.stay.checkOutAt))}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="planner-pill rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                        {section.stay.bookingStatus ?? "planned"}
                      </span>
                      {section.stay.hookup ? (
                        <span className="rounded-full border border-brand-support/35 bg-brand-support/18 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
                          Hookup
                        </span>
                      ) : null}
                      {section.stay.hardstanding ? (
                        <span className="planner-pill rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                          Hardstanding
                        </span>
                      ) : null}
                    </div>
                    {section.stay.amenitiesSummary ? (
                      <p className="planner-meta mt-1 text-app-muted">
                        {section.stay.amenitiesSummary}
                      </p>
                    ) : null}
                    {section.stay.notes ? (
                      <p className="planner-meta mt-1 text-app-muted">{section.stay.notes}</p>
                    ) : null}
                  </div>

                  <ItemActions
                    canMutate={canMutate}
                    isOfflineReadOnly={isOfflineReadOnly}
                    onEdit={() => onEdit(section.stay)}
                    onDelete={() => onDelete(section.stay)}
                  />
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
                canMutate={canMutate}
                isOfflineReadOnly={isOfflineReadOnly}
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
              className={`rounded-[24px] border bg-app-surface-muted/65 p-4 transition ${
                exactSelected
                  ? stopRowSelectedClass
                  : daySelected
                    ? "planner-selected-soft"
                    : "border-app-border"
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
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-state-info-surface text-state-info">
                        <StopTypeIcon kind="ferry" className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="planner-title-sm text-app-text">{section.ferry.title}</p>
                        <p className="planner-meta text-app-muted">
                          {section.ferry.departurePort.label} to {section.ferry.arrivalPort.label}
                        </p>
                      </div>
                    </div>
                    <p className="planner-meta mt-2 text-app-muted">
                      {ferryWindowLabel(section.ferry)}
                    </p>
                    <p className="planner-meta mt-1 text-app-muted">
                      Check-in by {formatDateTime(section.ferry.checkInBy)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {section.ferry.operator ? (
                        <span className="rounded-full border border-state-info-border bg-state-info-surface px-2 py-0.5 text-[11px] font-semibold text-state-info">
                          {section.ferry.operator}
                        </span>
                      ) : null}
                      {section.ferry.bookingRef ? (
                        <span className="planner-pill rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                          Ref {section.ferry.bookingRef}
                        </span>
                      ) : null}
                      {section.ferry.vehicleDetails?.vehicleType ? (
                        <span className="planner-pill rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                          {section.ferry.vehicleDetails.vehicleType}
                        </span>
                      ) : null}
                    </div>
                    {section.ferry.notes ? (
                      <p className="planner-meta mt-1 text-app-muted">{section.ferry.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <DateChip
                      date={section.primaryDate}
                      active={selectedDate === section.primaryDate}
                      onClick={onSelectDate}
                    />
                    <ItemActions
                      canMutate={canMutate}
                      isOfflineReadOnly={isOfflineReadOnly}
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
            className={`rounded-[24px] border bg-app-surface-muted/65 p-4 transition ${
              exactSelected
                ? stopRowSelectedClass
                : daySelected
                  ? "planner-selected-soft"
                  : "border-app-border"
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary/16 text-brand-secondary-variant">
                      <StopTypeIcon kind="point_of_interest" className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="planner-title-sm text-app-text">{section.poi.title}</p>
                      <p className="planner-meta text-app-muted">{section.poi.place.label}</p>
                    </div>
                  </div>
                  {section.poi.notes ? (
                    <p className="planner-meta mt-2 text-app-muted">{section.poi.notes}</p>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <DateChip
                    date={section.poi.visitDate}
                    active={selectedDate === section.poi.visitDate}
                    onClick={onSelectDate}
                  />
                  <ItemActions
                    canMutate={canMutate}
                    isOfflineReadOnly={isOfflineReadOnly}
                    onEdit={() => onEdit(section.poi)}
                    onDelete={() => onDelete(section.poi)}
                  />
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
