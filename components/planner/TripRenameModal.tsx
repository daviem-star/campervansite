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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="planner-eyebrow text-slate-500">Rename trip</p>
            <h2 className="planner-title-lg mt-2 text-slate-950">{currentName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="planner-eyebrow mb-1 block text-slate-500">Trip name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
          </label>

          {error ? (
            <p className="planner-copy rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isWorking}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isWorking ? "Saving..." : "Rename trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
