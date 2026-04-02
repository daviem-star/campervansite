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
      <label className="planner-eyebrow mb-1 block text-app-muted">{label}</label>
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
          className="planner-input w-full rounded-xl border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            void onSearch();
          }}
          disabled={isLoading || Boolean(isSelectingResult)}
          className="planner-button-primary rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
        >
          Search
        </button>
      </div>

      {selectedLabel && query === selectedLabel ? (
        <p className="planner-meta mt-1 text-brand-primary">Selected</p>
      ) : null}

      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-app-border bg-app-surface shadow-xl">
          {isLoading ? (
            <p className="planner-meta px-3 py-2 text-app-muted">Searching...</p>
          ) : null}

          {!isLoading && isSelectingResult ? (
            <p className="planner-meta px-3 py-2 text-app-muted">Saving nearby road access...</p>
          ) : null}

          {!isLoading && error ? (
            <p className="planner-meta px-3 py-2 text-state-error">{error}</p>
          ) : null}

          {!isLoading && !error && !hasSearchableQuery ? (
            <p className="planner-meta px-3 py-2 text-app-muted">
              Type at least 3 characters, then press Search.
            </p>
          ) : null}

          {!isLoading && !error && hasSearchableQuery && !showingSubmittedResults ? (
            <p className="planner-meta px-3 py-2 text-app-muted">
              Press Search to look up this place.
            </p>
          ) : null}

          {!isLoading && !error && showingSubmittedResults && results.length === 0 ? (
            <p className="planner-meta px-3 py-2 text-app-muted">No matching locations found.</p>
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
                  className="block w-full border-b border-app-border/60 px-3 py-2 text-left text-xs text-app-text transition hover:bg-app-surface-muted"
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
