"use client";

import { addDays, format, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import { todayDateInTimezone, toIsoFromLocalInput, toLocalInputFromIso } from "@/lib/date";
import { ensurePlaceRoutingCoordinates } from "@/lib/placeRoutingClient";
import { applyDefaultCheckInBy } from "@/lib/tripDerived";
import {
  FerryVehicleType,
  NewTripStop,
  PlaceRef,
  StayBookingStatus,
  StopType,
  TripStop,
} from "@/types/trip";
import StopSearchInput from "@/components/planner/StopSearchInput";

type StopEditorModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  stopType: StopType;
  initialStop: TripStop | null;
  onClose: () => void;
  onCreate: (stop: NewTripStop) => Promise<void>;
  onUpdate: (stop: TripStop) => Promise<void>;
};

const buildDefaultStayTimes = () => {
  const today = todayDateInTimezone();
  const nextDay = format(addDays(parseISO(`${today}T00:00:00Z`), 1), "yyyy-MM-dd");
  return {
    checkInAt: `${today}T15:00`,
    checkOutAt: `${nextDay}T11:00`,
  };
};

const buildDefaultFerryTimes = () => {
  const today = todayDateInTimezone();
  const departureAt = `${today}T13:30`;
  const checkInBufferMinutes = 45;
  return {
    departureAt,
    arrivalAt: `${today}T15:00`,
    checkInBy: toLocalInputFromIso(
      applyDefaultCheckInBy(toIsoFromLocalInput(departureAt), checkInBufferMinutes),
    ),
    checkInBufferMinutes,
  };
};

export default function StopEditorModal({
  isOpen,
  mode,
  stopType,
  initialStop,
  onClose,
  onCreate,
  onUpdate,
}: StopEditorModalProps) {
  const [type, setType] = useState<StopType>(stopType);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [stayPlace, setStayPlace] = useState<PlaceRef | null>(null);
  const [stayCheckInAt, setStayCheckInAt] = useState(buildDefaultStayTimes().checkInAt);
  const [stayCheckOutAt, setStayCheckOutAt] = useState(buildDefaultStayTimes().checkOutAt);
  const [stayCostPerNight, setStayCostPerNight] = useState("");
  const [stayBookingStatus, setStayBookingStatus] = useState<StayBookingStatus>("planned");
  const [stayHookup, setStayHookup] = useState(false);
  const [stayHardstanding, setStayHardstanding] = useState(false);
  const [stayAmenitiesSummary, setStayAmenitiesSummary] = useState("");
  const [stayPhone, setStayPhone] = useState("");
  const [stayWebsiteUrl, setStayWebsiteUrl] = useState("");

  const [ferryDeparturePort, setFerryDeparturePort] = useState<PlaceRef | null>(null);
  const [ferryArrivalPort, setFerryArrivalPort] = useState<PlaceRef | null>(null);
  const [ferryDepartureAt, setFerryDepartureAt] = useState(buildDefaultFerryTimes().departureAt);
  const [ferryArrivalAt, setFerryArrivalAt] = useState(buildDefaultFerryTimes().arrivalAt);
  const [ferryCheckInBy, setFerryCheckInBy] = useState(buildDefaultFerryTimes().checkInBy);
  const [ferryCheckInBufferMinutes, setFerryCheckInBufferMinutes] = useState(
    buildDefaultFerryTimes().checkInBufferMinutes,
  );
  const [ferryCheckInManual, setFerryCheckInManual] = useState(false);
  const [ferryOperator, setFerryOperator] = useState("");
  const [ferryBookingRef, setFerryBookingRef] = useState("");
  const [ferryVehicleType, setFerryVehicleType] = useState<FerryVehicleType>("campervan");
  const [ferryVehicleRegistration, setFerryVehicleRegistration] = useState("");
  const [ferryVehicleLengthMeters, setFerryVehicleLengthMeters] = useState("");
  const [ferryVehicleNotes, setFerryVehicleNotes] = useState("");

  const [poiPlace, setPoiPlace] = useState<PlaceRef | null>(null);
  const [poiVisitDate, setPoiVisitDate] = useState(todayDateInTimezone());

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const dialogTitle = useMemo(() => {
    if (mode === "edit") {
      return "Edit stop";
    }

    if (type === "stay") {
      return "Add stay";
    }

    if (type === "ferry") {
      return "Add ferry";
    }

    return "Add point of interest";
  }, [mode, type]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setError(null);
    setType(stopType);

    if (mode === "edit" && initialStop) {
      setTitle(initialStop.title);
      setNotes(initialStop.notes ?? "");

      if (initialStop.type === "stay") {
        setStayPlace(initialStop.place);
        setStayCheckInAt(toLocalInputFromIso(initialStop.checkInAt));
        setStayCheckOutAt(toLocalInputFromIso(initialStop.checkOutAt));
        setStayCostPerNight(
          typeof initialStop.costPerNight === "number" ? String(initialStop.costPerNight) : "",
        );
        setStayBookingStatus(initialStop.bookingStatus ?? "planned");
        setStayHookup(initialStop.hookup ?? false);
        setStayHardstanding(initialStop.hardstanding ?? false);
        setStayAmenitiesSummary(initialStop.amenitiesSummary ?? "");
        setStayPhone(initialStop.phone ?? "");
        setStayWebsiteUrl(initialStop.websiteUrl ?? "");
      }

      if (initialStop.type === "ferry") {
        setFerryDeparturePort(initialStop.departurePort);
        setFerryArrivalPort(initialStop.arrivalPort);
        setFerryDepartureAt(toLocalInputFromIso(initialStop.departureAt));
        setFerryArrivalAt(toLocalInputFromIso(initialStop.arrivalAt));
        setFerryCheckInBy(toLocalInputFromIso(initialStop.checkInBy));
        setFerryCheckInBufferMinutes(initialStop.checkInBufferMinutes ?? 45);
        setFerryOperator(initialStop.operator ?? "");
        setFerryBookingRef(initialStop.bookingRef ?? "");
        setFerryVehicleType(initialStop.vehicleDetails?.vehicleType ?? "campervan");
        setFerryVehicleRegistration(initialStop.vehicleDetails?.registration ?? "");
        setFerryVehicleLengthMeters(
          typeof initialStop.vehicleDetails?.lengthMeters === "number"
            ? String(initialStop.vehicleDetails.lengthMeters)
            : "",
        );
        setFerryVehicleNotes(initialStop.vehicleDetails?.notes ?? "");
        setFerryCheckInManual(true);
      }

      if (initialStop.type === "point_of_interest") {
        setPoiPlace(initialStop.place);
        setPoiVisitDate(initialStop.visitDate);
      }

      return;
    }

    const defaultStay = buildDefaultStayTimes();
    const defaultFerry = buildDefaultFerryTimes();

    setTitle("");
    setNotes("");

    setStayPlace(null);
    setStayCheckInAt(defaultStay.checkInAt);
    setStayCheckOutAt(defaultStay.checkOutAt);
    setStayCostPerNight("");
    setStayBookingStatus("planned");
    setStayHookup(false);
    setStayHardstanding(false);
    setStayAmenitiesSummary("");
    setStayPhone("");
    setStayWebsiteUrl("");

    setFerryDeparturePort(null);
    setFerryArrivalPort(null);
    setFerryDepartureAt(defaultFerry.departureAt);
    setFerryArrivalAt(defaultFerry.arrivalAt);
    setFerryCheckInBy(defaultFerry.checkInBy);
    setFerryCheckInBufferMinutes(defaultFerry.checkInBufferMinutes);
    setFerryCheckInManual(false);
    setFerryOperator("");
    setFerryBookingRef("");
    setFerryVehicleType("campervan");
    setFerryVehicleRegistration("");
    setFerryVehicleLengthMeters("");
    setFerryVehicleNotes("");

    setPoiPlace(null);
    setPoiVisitDate(todayDateInTimezone());
  }, [initialStop, isOpen, mode, stopType]);

  useEffect(() => {
    if (type !== "ferry" || ferryCheckInManual) {
      return;
    }

    try {
      const departureIso = toIsoFromLocalInput(ferryDepartureAt);
      setFerryCheckInBy(
        toLocalInputFromIso(applyDefaultCheckInBy(departureIso, ferryCheckInBufferMinutes)),
      );
    } catch {
      // Keep previous value while input is incomplete.
    }
  }, [ferryCheckInBufferMinutes, ferryCheckInManual, ferryDepartureAt, type]);

  if (!isOpen) {
    return null;
  }

  const parseLocalDateTimeInput = (value: string, fieldLabel: string): string => {
    if (!value.trim()) {
      throw new Error(`${fieldLabel} is required.`);
    }

    try {
      return toIsoFromLocalInput(value);
    } catch {
      throw new Error(`Enter a valid ${fieldLabel.toLowerCase()} date and time.`);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError("Title is required.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      if (type === "stay") {
        if (!stayPlace) {
          setError("Stay location is required.");
          return;
        }

        const resolvedStayPlace = await ensurePlaceRoutingCoordinates(stayPlace);

        const checkInIso = parseLocalDateTimeInput(stayCheckInAt, "Check-in");
        const checkOutIso = parseLocalDateTimeInput(stayCheckOutAt, "Check-out");

        if (new Date(checkOutIso).getTime() <= new Date(checkInIso).getTime()) {
          setError("Checkout must be after check-in.");
          return;
        }

        const parsedCost =
          stayCostPerNight.trim().length > 0 ? Number.parseFloat(stayCostPerNight) : undefined;

        if (typeof parsedCost === "number" && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
          setError("Cost per night must be a valid number of 0 or more.");
          return;
        }

        const payload: NewTripStop = {
          type: "stay",
          title: normalizedTitle,
          notes: notes.trim() || undefined,
          place: resolvedStayPlace,
          checkInAt: checkInIso,
          checkOutAt: checkOutIso,
          costPerNight: parsedCost,
          bookingStatus: stayBookingStatus,
          hookup: stayHookup,
          hardstanding: stayHardstanding,
          amenitiesSummary: stayAmenitiesSummary.trim() || undefined,
          phone: stayPhone.trim() || undefined,
          websiteUrl: stayWebsiteUrl.trim() || undefined,
        };

        if (mode === "edit" && initialStop) {
          await onUpdate({ ...initialStop, ...payload });
        } else {
          await onCreate(payload);
        }
      }

      if (type === "ferry") {
        if (!ferryDeparturePort || !ferryArrivalPort) {
          setError("Both departure and arrival ports are required.");
          return;
        }

        const resolvedDeparturePort = await ensurePlaceRoutingCoordinates(ferryDeparturePort);
        const resolvedArrivalPort = await ensurePlaceRoutingCoordinates(ferryArrivalPort);

        const departureIso = parseLocalDateTimeInput(ferryDepartureAt, "Departure");
        const arrivalIso = parseLocalDateTimeInput(ferryArrivalAt, "Arrival");
        const checkInByIso = parseLocalDateTimeInput(ferryCheckInBy, "Check-in by");

        if (new Date(arrivalIso).getTime() <= new Date(departureIso).getTime()) {
          setError("Arrival time must be after departure.");
          return;
        }

        if (new Date(checkInByIso).getTime() >= new Date(departureIso).getTime()) {
          setError("Check-in by time must be before departure.");
          return;
        }

        const parsedVehicleLength =
          ferryVehicleLengthMeters.trim().length > 0
            ? Number.parseFloat(ferryVehicleLengthMeters)
            : undefined;

        if (
          typeof parsedVehicleLength === "number" &&
          (!Number.isFinite(parsedVehicleLength) || parsedVehicleLength <= 0)
        ) {
          setError("Vehicle length must be a valid number greater than 0.");
          return;
        }

        const payload: NewTripStop = {
          type: "ferry",
          title: normalizedTitle,
          notes: notes.trim() || undefined,
          departurePort: resolvedDeparturePort,
          arrivalPort: resolvedArrivalPort,
          departureAt: departureIso,
          arrivalAt: arrivalIso,
          checkInBy: checkInByIso,
          operator: ferryOperator.trim() || undefined,
          bookingRef: ferryBookingRef.trim() || undefined,
          checkInBufferMinutes: ferryCheckInBufferMinutes,
          vehicleDetails: {
            vehicleType: ferryVehicleType,
            registration: ferryVehicleRegistration.trim() || undefined,
            lengthMeters: parsedVehicleLength,
            notes: ferryVehicleNotes.trim() || undefined,
          },
        };

        if (mode === "edit" && initialStop) {
          await onUpdate({ ...initialStop, ...payload });
        } else {
          await onCreate(payload);
        }
      }

      if (type === "point_of_interest") {
        if (!poiPlace) {
          setError("Point of interest location is required.");
          return;
        }

        const resolvedPoiPlace = await ensurePlaceRoutingCoordinates(poiPlace);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(poiVisitDate)) {
          setError("Visit date is required.");
          return;
        }

        const payload: NewTripStop = {
          type: "point_of_interest",
          title: normalizedTitle,
          notes: notes.trim() || undefined,
          place: resolvedPoiPlace,
          visitDate: poiVisitDate,
        };

        if (mode === "edit" && initialStop) {
          await onUpdate({ ...initialStop, ...payload });
        } else {
          await onCreate(payload);
        }
      }

      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save stop right now.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{dialogTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "create" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Stop type
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "stay", label: "Stay" },
                  { id: "ferry", label: "Ferry" },
                  { id: "point_of_interest", label: "Point of Interest" },
                ] as const).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setType(option.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      type === option.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Title
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              placeholder="Stop title"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {type === "stay" ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <StopSearchInput
                label="Campsite location"
                placeholder="Search campsite"
                value={stayPlace}
                onSelect={setStayPlace}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Check-in
                  </label>
                  <input
                    type="datetime-local"
                    value={stayCheckInAt}
                    onChange={(event) => setStayCheckInAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Check-out
                  </label>
                  <input
                    type="datetime-local"
                    value={stayCheckOutAt}
                    onChange={(event) => setStayCheckOutAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Cost per night (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stayCostPerNight}
                  onChange={(event) => setStayCostPerNight(event.target.value)}
                  placeholder="e.g. 38"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Booking status
                  </label>
                  <select
                    value={stayBookingStatus}
                    onChange={(event) => setStayBookingStatus(event.target.value as StayBookingStatus)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    <option value="planned">Planned</option>
                    <option value="booked">Booked</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Contact phone (optional)
                  </label>
                  <input
                    value={stayPhone}
                    onChange={(event) => setStayPhone(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Website URL (optional)
                </label>
                <input
                  value={stayWebsiteUrl}
                  onChange={(event) => setStayWebsiteUrl(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Amenities summary (optional)
                </label>
                <textarea
                  value={stayAmenitiesSummary}
                  onChange={(event) => setStayAmenitiesSummary(event.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={stayHookup}
                    onChange={(event) => setStayHookup(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  Electric hookup
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={stayHardstanding}
                    onChange={(event) => setStayHardstanding(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  Hardstanding pitch
                </label>
              </div>
            </div>
          ) : null}

          {type === "ferry" ? (
            <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StopSearchInput
                  label="Departure port"
                  placeholder="Search departure port"
                  value={ferryDeparturePort}
                  onSelect={setFerryDeparturePort}
                />
                <StopSearchInput
                  label="Arrival port"
                  placeholder="Search arrival port"
                  value={ferryArrivalPort}
                  onSelect={setFerryArrivalPort}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Departure
                  </label>
                  <input
                    type="datetime-local"
                    value={ferryDepartureAt}
                    onChange={(event) => setFerryDepartureAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Arrival
                  </label>
                  <input
                    type="datetime-local"
                    value={ferryArrivalAt}
                    onChange={(event) => setFerryArrivalAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Check-in by
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const departureIso = toIsoFromLocalInput(ferryDepartureAt);
                        const defaultCheckIn = applyDefaultCheckInBy(
                          departureIso,
                          ferryCheckInBufferMinutes,
                        );
                        setFerryCheckInBy(toLocalInputFromIso(defaultCheckIn));
                        setFerryCheckInManual(false);
                      } catch {
                        // Ignore invalid input state.
                      }
                    }}
                    className="text-xs font-semibold text-cyan-700"
                  >
                    Use default -45m
                  </button>
                </div>
                <input
                  type="datetime-local"
                  value={ferryCheckInBy}
                  onChange={(event) => {
                    setFerryCheckInBy(event.target.value);
                    setFerryCheckInManual(true);
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Check-in buffer (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={ferryCheckInBufferMinutes}
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.target.value, 10);
                    setFerryCheckInBufferMinutes(Number.isFinite(nextValue) ? nextValue : 45);
                    setFerryCheckInManual(false);
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Operator (optional)
                  </label>
                  <input
                    value={ferryOperator}
                    onChange={(event) => setFerryOperator(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Booking ref (optional)
                  </label>
                  <input
                    value={ferryBookingRef}
                    onChange={(event) => setFerryBookingRef(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Vehicle type
                  </label>
                  <select
                    value={ferryVehicleType}
                    onChange={(event) => setFerryVehicleType(event.target.value as FerryVehicleType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    <option value="campervan">Campervan</option>
                    <option value="motorhome">Motorhome</option>
                    <option value="van">Van</option>
                    <option value="car">Car</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Registration
                  </label>
                  <input
                    value={ferryVehicleRegistration}
                    onChange={(event) => setFerryVehicleRegistration(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Length (m)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={ferryVehicleLengthMeters}
                    onChange={(event) => setFerryVehicleLengthMeters(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Vehicle notes (optional)
                </label>
                <textarea
                  value={ferryVehicleNotes}
                  onChange={(event) => setFerryVehicleNotes(event.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          ) : null}

          {type === "point_of_interest" ? (
            <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
              <StopSearchInput
                label="POI location"
                placeholder="Search point of interest"
                value={poiPlace}
                onSelect={setPoiPlace}
              />

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Visit date
                </label>
                <input
                  type="date"
                  value={poiVisitDate}
                  onChange={(event) => setPoiVisitDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Saving..." : mode === "edit" ? "Update stop" : "Add stop"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
