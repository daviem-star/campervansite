"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { GeocodeResult, PlaceRef } from "@/types/trip";

type StopSearchInputProps = {
  label: string;
  placeholder: string;
  value: PlaceRef | null;
  onSelect: (value: PlaceRef) => void;
};

export default function StopSearchInput({
  label,
  placeholder,
  value,
  onSelect,
}: StopSearchInputProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value?.label]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  useEffect(() => {
    const normalized = query.trim();

    if (normalized.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(normalized)}`);
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          if (cancelled) {
            return;
          }
          setError(body.error ?? "Search failed.");
          setResults([]);
          return;
        }

        const json = (await response.json()) as GeocodeResult[];
        if (cancelled) {
          return;
        }
        setResults(json);
      } catch {
        if (cancelled) {
          return;
        }
        setError("Location service is unavailable right now.");
        setResults([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const selectedLabel = useMemo(() => value?.label ?? "", [value?.label]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </label>
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
      />

      {selectedLabel && query === selectedLabel ? (
        <p className="mt-1 text-xs text-emerald-600">Selected</p>
      ) : null}

      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {isLoading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Searching...</p>
          ) : null}

          {!isLoading && error ? (
            <p className="px-3 py-2 text-xs text-rose-500">{error}</p>
          ) : null}

          {!isLoading && !error && query.trim().length < 2 ? (
            <p className="px-3 py-2 text-xs text-slate-500">Type at least 2 characters.</p>
          ) : null}

          {!isLoading && !error && query.trim().length >= 2 && results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No matching locations found.</p>
          ) : null}

          {!isLoading && !error
            ? results.map((result) => (
                <button
                  key={`${result.osmType}-${result.osmId}-${result.lat}-${result.lng}`}
                  type="button"
                  onClick={() => {
                    onSelect({
                      label: result.label,
                      coordinates: { lat: result.lat, lng: result.lng },
                      osmId: result.osmId,
                      osmType: result.osmType,
                    });
                    setQuery(result.label);
                    setIsOpen(false);
                  }}
                  className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50"
                >
                  {result.label}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
