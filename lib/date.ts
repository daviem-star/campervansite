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

export const formatTime = (isoValue: string): string => {
  return formatInTimeZone(isoValue, APP_TIMEZONE, "HH:mm");
};

export const formatDate = (isoValue: string): string => {
  return formatInTimeZone(isoValue, APP_TIMEZONE, "dd/MM/yyyy");
};

export const formatDateOnly = (dateValue: string): string => {
  return formatInTimeZone(`${dateValue}T12:00:00Z`, APP_TIMEZONE, "dd/MM/yyyy");
};

export const formatDayChip = (dateValue: string): string => {
  return formatInTimeZone(`${dateValue}T12:00:00Z`, APP_TIMEZONE, "EEE");
};

export const formatDayNumber = (dateValue: string): string => {
  return formatInTimeZone(`${dateValue}T12:00:00Z`, APP_TIMEZONE, "d");
};

export const formatDateChipShort = (dateValue: string): string => {
  return formatInTimeZone(`${dateValue}T12:00:00Z`, APP_TIMEZONE, "dd/MM");
};

export const nowIso = (): string => new Date().toISOString();

export const todayDateInTimezone = (): string => {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
};

export const isSameDateInTimezone = (isoValue: string, dateValue: string): boolean => {
  return dateOnlyFromIso(isoValue) === dateValue;
};

export const buildDateRange = (startDate: string, endDate: string): string[] => {
  const start = parseISO(`${startDate}T12:00:00Z`);
  const end = parseISO(`${endDate}T12:00:00Z`);
  const totalDays = Math.max(0, differenceInCalendarDays(end, start));

  return Array.from({ length: totalDays + 1 }, (_, index) => {
    return formatInTimeZone(addDays(start, index), APP_TIMEZONE, "yyyy-MM-dd");
  });
};

export const addMinutesIso = (isoValue: string, minutes: number): string => {
  return new Date(new Date(isoValue).getTime() + minutes * 60_000).toISOString();
};

export const shiftIsoByDays = (isoValue: string, dayOffset: number): string => {
  const zoned = toZonedTime(isoValue, APP_TIMEZONE);
  const shiftedZoned = addDays(zoned, dayOffset);
  return fromZonedTime(shiftedZoned, APP_TIMEZONE).toISOString();
};

export const shiftDateOnlyByDays = (dateValue: string, dayOffset: number): string => {
  const base = parseISO(`${dateValue}T12:00:00Z`);
  return formatInTimeZone(addDays(base, dayOffset), APP_TIMEZONE, "yyyy-MM-dd");
};
