"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import PlannerApp from "@/components/planner/PlannerApp";
import TripLanding from "@/components/planner/TripLanding";
import { useTripStore } from "@/store/useTripStore";

type ViewMode = "landing" | "planner";

export default function PlannerHome() {
  const {
    data,
    isLoading,
    error,
    loadData,
    setActiveTrip,
    createTrip,
    deleteTrip,
    resetToSeedAlignedToToday,
    exportData,
    importData,
  } = useTripStore();
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!data && !isLoading) {
      void loadData();
    }
  }, [data, isLoading, loadData]);

  const activeError = importError ?? error;

  const trips = useMemo(() => data?.trips ?? [], [data]);
  const activeTripId = data?.activeTripId ?? "";

  const handleOpenTrip = async (tripId: string) => {
    await setActiveTrip(tripId);
    setImportError(null);
    setViewMode("planner");
  };

  const handleCreateTrip = async (name: string) => {
    const created = await createTrip(name);
    if (created) {
      setImportError(null);
      setViewMode("planner");
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    const confirmed = window.confirm("Delete this trip? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    await deleteTrip(tripId);
  };

  const handleExportData = () => {
    const payload = exportData();
    if (!payload) {
      return;
    }

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "campervan-trip-data.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleImportData = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const text = await file.text();
    const result = await importData(text);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setImportError(null);
    setViewMode("landing");
  };

  if (viewMode === "planner") {
    return (
      <>
        <PlannerApp
          onBackToTrips={() => setViewMode("landing")}
          onExportData={handleExportData}
          onImportData={handleImportData}
          onLoadAlignedSeed={() => void resetToSeedAlignedToToday()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => void onFileSelected(event)}
          className="hidden"
        />
      </>
    );
  }

  return (
    <>
      <TripLanding
        trips={trips}
        activeTripId={activeTripId}
        isBusy={isLoading}
        error={activeError}
        onOpenTrip={(tripId) => void handleOpenTrip(tripId)}
        onCreateTrip={handleCreateTrip}
        onDeleteTrip={handleDeleteTrip}
        onLoadAlignedSeed={() => resetToSeedAlignedToToday()}
        onExportData={handleExportData}
        onImportData={handleImportData}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={(event) => void onFileSelected(event)}
        className="hidden"
      />
    </>
  );
}
