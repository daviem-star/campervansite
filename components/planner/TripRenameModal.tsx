"use client";

import { useState } from "react";

type TripRenameModalProps = {
  isOpen: boolean;
  isWorking: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (name: string) => Promise<boolean>;
};

export default function TripRenameModal({
  isOpen,
  isWorking,
  currentName,
  onClose,
  onRename,
}: TripRenameModalProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextName = name.trim();
    if (!nextName) {
      setError("Trip name is required.");
      return;
    }

    setError(null);
    const didRename = await onRename(nextName);
    if (didRename) {
      onClose();
    }
  };

  return (
    <div className="planner-overlay fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl border border-app-border bg-app-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="planner-eyebrow text-app-muted">Rename trip</p>
            <h2 className="planner-title-lg mt-2 text-app-text">{currentName}</h2>
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
          <label className="block">
            <span className="planner-eyebrow mb-1 block text-app-muted">Trip name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="planner-input w-full rounded-2xl border px-4 py-3 text-sm"
            />
          </label>

          {error ? (
            <p className="planner-copy tone-error rounded-2xl border px-4 py-3">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
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
              {isWorking ? "Saving..." : "Rename trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
