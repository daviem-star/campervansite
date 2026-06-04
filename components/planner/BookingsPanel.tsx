"use client";

import StopTypeIcon from "@/components/planner/StopTypeIcon";
import { formatDateTime } from "@/lib/date";
import type { BookingView } from "@/lib/tripLibraryViews";

type BookingsPanelProps = {
  bookings: BookingView[];
  loadedTripCount: number;
  totalTripCount: number;
  isOfflineReadOnly: boolean;
  onOpenBooking: (booking: BookingView) => void;
};

const BookingList = ({
  title,
  bookings,
  onOpenBooking,
}: {
  title: string;
  bookings: BookingView[];
  onOpenBooking: (booking: BookingView) => void;
}) => (
  <section>
    <div className="flex items-center justify-between gap-3 border-b border-app-border bg-app-surface-muted/50 px-5 py-3">
      <h3 className="planner-title-md text-app-text">{title}</h3>
      <span className="planner-pill rounded-full border px-2.5 py-1 text-xs font-semibold">{bookings.length}</span>
    </div>
    {bookings.length === 0 ? <p className="planner-copy px-5 py-4 text-app-muted">No {title.toLowerCase()} bookings.</p> : null}
    <div className="divide-y divide-app-border">
      {bookings.map((booking) => (
        <button key={booking.id} type="button" onClick={() => onOpenBooking(booking)} className="planner-clickable-row block w-full px-5 py-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StopTypeIcon kind={booking.kind} className="h-4 w-4 text-brand-primary" />
                <p className="planner-title-md text-app-text">{booking.stopTitle}</p>
              </div>
              <p className="planner-copy-sm mt-1 text-app-muted">{booking.tripName} · {booking.locationLabel}</p>
              <p className="planner-meta mt-1 text-app-muted">
                {formatDateTime(booking.startAt)}
                {booking.kind === "ferry" && booking.checkInBy ? ` · Check-in by ${formatDateTime(booking.checkInBy)}` : ""}
              </p>
              <p className="planner-meta mt-1 text-app-muted">
                {[booking.operator, booking.bookingRef ? `Ref ${booking.bookingRef}` : null, booking.totalCost !== undefined ? `GBP ${booking.totalCost.toFixed(2)}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${booking.needsAttention ? "tone-warning" : "tone-success"}`}>
              {booking.status.replaceAll("-", " ")}
            </span>
          </div>
        </button>
      ))}
    </div>
  </section>
);

export default function BookingsPanel({
  bookings,
  loadedTripCount,
  totalTripCount,
  isOfflineReadOnly,
  onOpenBooking,
}: BookingsPanelProps) {
  const upcoming = bookings.filter((booking) => !booking.isPast);
  const past = bookings.filter((booking) => booking.isPast).reverse();
  const attentionCount = bookings.filter((booking) => booking.needsAttention).length;

  return (
    <section data-testid="desktop-bookings-panel" className="min-h-0 overflow-hidden rounded-[24px] border border-app-border bg-app-surface lg:flex lg:flex-col">
      <div className="border-b border-app-border px-5 py-5">
        <p className="planner-eyebrow planner-section-label">Bookings</p>
        <h2 className="planner-title-xl mt-2 text-app-text">Campsite and ferry bookings</h2>
        <p className="planner-copy mt-2 text-app-muted">Review booking details already recorded across your trips.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">{bookings.length} bookings</span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${attentionCount > 0 ? "tone-warning" : "tone-success"}`}>{attentionCount} need attention</span>
          <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">{loadedTripCount} of {totalTripCount} trips loaded</span>
        </div>
        {isOfflineReadOnly && loadedTripCount < totalTripCount ? (
          <p className="planner-copy-sm tone-warning mt-3 rounded-xl border px-3 py-2">Offline view: bookings from uncached trips are not shown.</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <BookingList title="Upcoming" bookings={upcoming} onOpenBooking={onOpenBooking} />
        <BookingList title="Past" bookings={past} onOpenBooking={onOpenBooking} />
      </div>
    </section>
  );
}
