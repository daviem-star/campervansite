import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = "Europe/London";

export const toIsoFromLocalInput = (localValue: string): string => {
  return fromZonedTime(localValue, APP_TIMEZONE).toISOString();
};

export const toLocalInputFromIso = (isoValue: string): string => {
  const zoned = toZonedTime(isoValue, APP_TIMEZONE);
  return format(zoned, "yyyy-MM-dd'T'HH:mm");
};

export const dateOnlyFromIso = (isoValue: string): string => {
  return formatInTimeZone(isoValue, APP_TIMEZONE, "yyyy-MM-dd");
};

export const formatDateTime = (isoValue: string): string => {
  return formatInTimeZone(isoValue, APP_TIMEZONE, "dd/MM/yyyy HH:mm");
};

export const formatDate = (isoValue: string): string => {
  return formatInTimeZone(isoValue, APP_TIMEZONE, "dd/MM/yyyy");
};

export const formatDateOnly = (dateValue: string): string => {
  const parsed = parseISO(`${dateValue}T00:00:00Z`);
  return format(parsed, "dd/MM/yyyy");
};

export const formatDayChip = (dateValue: string): string => {
  const parsed = parseISO(`${dateValue}T00:00:00Z`);
  return format(parsed, "EEE");
};

export const formatDayNumber = (dateValue: string): string => {
  const parsed = parseISO(`${dateValue}T00:00:00Z`);
  return format(parsed, "d");
};

export const nowIso = (): string => new Date().toISOString();

export const todayDateInTimezone = (): string => {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
};

export const isSameDateInTimezone = (isoValue: string, dateValue: string): boolean => {
  return dateOnlyFromIso(isoValue) === dateValue;
};

export const buildDateRange = (startDate: string, endDate: string): string[] => {
  const start = parseISO(`${startDate}T00:00:00Z`);
  const end = parseISO(`${endDate}T00:00:00Z`);
  const totalDays = Math.max(0, differenceInCalendarDays(end, start));

  return Array.from({ length: totalDays + 1 }, (_, index) => {
    return format(addDays(start, index), "yyyy-MM-dd");
  });
};

export const addMinutesIso = (isoValue: string, minutes: number): string => {
  return new Date(new Date(isoValue).getTime() + minutes * 60_000).toISOString();
};
