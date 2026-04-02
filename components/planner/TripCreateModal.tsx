"use client";

import { useState } from "react";

import StopSearchInput from "@/components/planner/StopSearchInput";
import { CreateTripInput, CreateTripSource, PlaceRef } from "@/types/trip";

type TripCreateModalProps = {
  isOpen: boolean;
  isWorking: boolean;
  defaultExampleName: string;
  onClose: () => void;
  onCreate: (input: CreateTripInput) => Promise<boolean>;
};

export default function TripCreateModal({
  isOpen,
  isWorking,
  defaultExampleName,
  onClose,
  onCreate,
}: TripCreateModalProps) {
  const [source, setSource] = useState<CreateTripSource>("blank");
  const [name, setName] = useState("");
  const [home, setHome] = useState<PlaceRef | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextName = name.trim() || (source === "example" ? defaultExampleName : "");
    if (!nextName) {
      setError("Trip name is required.");
      return;
    }

    if (source === "blank" && !home) {
      setError("Home pin is required for a blank trip.");
      return;
    }

    setError(null);
    const didCreate = await onCreate({
      source,
      name: nextName,
      home: source === "blank" ? home ?? undefined : undefined,
    });

    if (didCreate) {
      onClose();
    }
  };

  return (
    <div className="planner-overlay fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-app-border bg-app-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="planner-eyebrow text-app-muted">New trip</p>
            <h2 className="planner-title-lg mt-2 text-app-text">Create another trip</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="planner-button-secondary rounded-xl border px-3 py-1.5 text-sm transition"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="planner-eyebrow mb-2 block text-app-muted">Trip source</label>
            <div className="flex flex-wrap gap-2">
              {([
                {
                  id: "blank",
                  label: "Blank",
                  detail: "Start from an empty trip and add your own itinerary.",
                },
                {
                  id: "example",
                  label: "Example",
                  detail: "Clone the seeded example trip into your cloud library.",
                },
              ] as const).map((option) => {
                const active = source === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`trip-source-${option.id}`}
                    onClick={() => {
                      setSource(option.id);
                      if (option.id === "example" && name.trim().length === 0) {
                        setName(defaultExampleName);
                      }
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-brand-primary bg-brand-primary text-brand-on-primary"
                        : "border-app-border bg-app-surface text-app-muted hover:bg-app-surface-muted"
                    }`}
                  >
                    <p className="planner-title-sm">{option.label}</p>
                    <p className={`planner-copy-sm mt-1 ${active ? "text-brand-on-primary/80" : "text-app-muted"}`}>
                      {option.detail}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="planner-eyebrow mb-1 block text-app-muted">Trip name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={source === "example" ? defaultExampleName : "New trip"}
              className="planner-input w-full rounded-2xl border px-4 py-3 text-sm"
            />
          </label>

          {source === "blank" ? (
            <StopSearchInput
              label="Home pin"
              placeholder="Search home base"
              value={home}
              onSelect={setHome}
            />
          ) : (
            <div className="planner-copy rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3 text-app-muted">
              The seeded example itinerary will be copied into your trip library with a fresh trip
              id and timestamps.
            </div>
          )}

          {error ? (
            <p className="planner-copy tone-error rounded-2xl border px-4 py-3">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="planner-button-secondary rounded-2xl border px-4 py-3 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isWorking}
              className="planner-button-primary rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
            >
              {isWorking ? "Creating..." : "Create trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
