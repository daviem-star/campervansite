"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { ensurePlaceRoutingCoordinates } from "@/lib/placeRoutingClient";
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
  const [isSelectingResult, setIsSelectingResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value?.label ?? "");
    setLastSubmittedQuery(value?.label?.trim() ?? "");
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

  const selectedLabel = useMemo(() => value?.label ?? "", [value?.label]);
  const normalizedQuery = query.trim();
  const hasSearchableQuery = normalizedQuery.length >= 3;
  const showingSubmittedResults = lastSubmittedQuery === normalizedQuery;

  const onSearch = async () => {
    setIsOpen(true);

    if (!hasSearchableQuery) {
      setResults([]);
      setError(null);
      setLastSubmittedQuery("");
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastSubmittedQuery(normalizedQuery);

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(normalizedQuery)}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Search failed.");
        setResults([]);
        return;
      }

      const json = (await response.json()) as GeocodeResult[];
      setResults(json);
    } catch {
      setError("Location service is unavailable right now.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSelectResult = async (result: GeocodeResult) => {
    const selectionKey = `${result.osmType}-${result.osmId}-${result.lat}-${result.lng}`;
    setIsSelectingResult(selectionKey);

    try {
      const place = await ensurePlaceRoutingCoordinates({
        label: result.label,
        coordinates: { lat: result.lat, lng: result.lng },
        osmId: result.osmId,
        osmType: result.osmType,
      });

      onSelect(place);
      setQuery(place.label);
      setIsOpen(false);
    } finally {
      setIsSelectingResult(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </label>
      <div className="flex items-start gap-2">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setError(null);
            setResults([]);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onSearch();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            void onSearch();
          }}
          disabled={isLoading || Boolean(isSelectingResult)}
          className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Search
        </button>
      </div>

      {selectedLabel && query === selectedLabel ? (
        <p className="mt-1 text-xs text-emerald-600">Selected</p>
      ) : null}

      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {isLoading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Searching...</p>
          ) : null}

          {!isLoading && isSelectingResult ? (
            <p className="px-3 py-2 text-xs text-slate-500">Saving nearby road access...</p>
          ) : null}

          {!isLoading && error ? (
            <p className="px-3 py-2 text-xs text-rose-500">{error}</p>
          ) : null}

          {!isLoading && !error && !hasSearchableQuery ? (
            <p className="px-3 py-2 text-xs text-slate-500">
              Type at least 3 characters, then press Search.
            </p>
          ) : null}

          {!isLoading && !error && hasSearchableQuery && !showingSubmittedResults ? (
            <p className="px-3 py-2 text-xs text-slate-500">
              Press Search to look up this place.
            </p>
          ) : null}

          {!isLoading && !error && showingSubmittedResults && results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No matching locations found.</p>
          ) : null}

          {!isLoading && !error && showingSubmittedResults
            ? results.map((result) => (
                <button
                  key={`${result.osmType}-${result.osmId}-${result.lat}-${result.lng}`}
                  type="button"
                  onClick={() => {
                    void onSelectResult(result);
                  }}
                  disabled={Boolean(isSelectingResult)}
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
