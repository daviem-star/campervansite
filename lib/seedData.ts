import { toIsoFromLocalInput } from "@/lib/date";
import { AppDataV1, Trip } from "@/types/trip";

const seedTrip: Trip = {
  id: "trip_outer_hebrides_2026",
  name: "Outer Hebrides Family Trip",
  timezone: "Europe/London",
  home: {
    label: "Killearn, Scotland",
    coordinates: { lat: 56.0423, lng: -4.3649 },
  },
  createdAt: toIsoFromLocalInput("2026-07-01T09:00"),
  updatedAt: toIsoFromLocalInput("2026-07-01T09:00"),
  stops: [
    {
      id: "stop_ferry_1",
      order: 0,
      type: "ferry",
      title: "Oban to Castlebay",
      departurePort: {
        label: "Oban Ferry Terminal",
        coordinates: { lat: 56.412, lng: -5.4723 },
      },
      arrivalPort: {
        label: "Castlebay Ferry Terminal",
        coordinates: { lat: 56.9567, lng: -7.4873 },
      },
      departureAt: toIsoFromLocalInput("2026-08-05T13:30"),
      arrivalAt: toIsoFromLocalInput("2026-08-05T18:15"),
      checkInBy: toIsoFromLocalInput("2026-08-05T12:45"),
      notes: "2 adults, 1 child, campervan booked.",
      operator: "CalMac",
      bookingRef: "HEB-OBN-001",
    },
    {
      id: "stop_stay_1",
      order: 1,
      type: "stay",
      title: "Barra Sands Campsite",
      place: {
        label: "Barra Sands Campsite",
        coordinates: { lat: 57.04, lng: -7.458 },
      },
      checkInAt: toIsoFromLocalInput("2026-08-05T19:00"),
      checkOutAt: toIsoFromLocalInput("2026-08-08T11:00"),
      costPerNight: 38,
    },
    {
      id: "stop_poi_1",
      order: 2,
      type: "point_of_interest",
      title: "Vatersay Beach Walk",
      place: {
        label: "Vatersay Beach, Barra",
        coordinates: { lat: 56.9247, lng: -7.5464 },
      },
      visitDate: "2026-08-06",
      notes: "Afternoon walk and sunset.",
    },
    {
      id: "stop_ferry_2",
      order: 3,
      type: "ferry",
      title: "Ardmhor to Eriskay",
      departurePort: {
        label: "Ardmhor Ferry Terminal",
        coordinates: { lat: 57.0136, lng: -7.4437 },
      },
      arrivalPort: {
        label: "Eriskay Ferry Terminal",
        coordinates: { lat: 57.0831, lng: -7.2146 },
      },
      departureAt: toIsoFromLocalInput("2026-08-08T15:45"),
      arrivalAt: toIsoFromLocalInput("2026-08-08T16:25"),
      checkInBy: toIsoFromLocalInput("2026-08-08T15:25"),
      notes: "Keep snacks and ferry tickets ready.",
      operator: "CalMac",
      bookingRef: "HEB-ARD-002",
    },
    {
      id: "stop_stay_2",
      order: 4,
      type: "stay",
      title: "Kilbride Campsite",
      place: {
        label: "Kilbride Campsite, South Uist",
        coordinates: { lat: 57.2237, lng: -7.3621 },
      },
      checkInAt: toIsoFromLocalInput("2026-08-08T17:00"),
      checkOutAt: toIsoFromLocalInput("2026-08-11T08:00"),
      costPerNight: 36,
    },
    {
      id: "stop_poi_2",
      order: 5,
      type: "point_of_interest",
      title: "Howmore Ruins",
      place: {
        label: "Howmore, South Uist",
        coordinates: { lat: 57.2834, lng: -7.3552 },
      },
      visitDate: "2026-08-09",
    },
    {
      id: "stop_ferry_3",
      order: 6,
      type: "ferry",
      title: "Berneray to Leverburgh",
      departurePort: {
        label: "Berneray Ferry Terminal",
        coordinates: { lat: 57.7179, lng: -7.17 },
      },
      arrivalPort: {
        label: "Leverburgh Ferry Terminal",
        coordinates: { lat: 57.7662, lng: -7.0228 },
      },
      departureAt: toIsoFromLocalInput("2026-08-11T09:30"),
      arrivalAt: toIsoFromLocalInput("2026-08-11T10:30"),
      checkInBy: toIsoFromLocalInput("2026-08-11T09:10"),
      operator: "CalMac",
      bookingRef: "HEB-BER-003",
    },
    {
      id: "stop_stay_3",
      order: 7,
      type: "stay",
      title: "Horgabost Campsite",
      place: {
        label: "Horgabost Campsite, Harris",
        coordinates: { lat: 57.8725, lng: -6.9346 },
      },
      checkInAt: toIsoFromLocalInput("2026-08-11T12:00"),
      checkOutAt: toIsoFromLocalInput("2026-08-13T13:30"),
      costPerNight: 40,
    },
    {
      id: "stop_poi_3",
      order: 8,
      type: "point_of_interest",
      title: "Luskentyre Beach",
      place: {
        label: "Luskentyre Beach, Harris",
        coordinates: { lat: 57.8622, lng: -6.9593 },
      },
      visitDate: "2026-08-12",
    },
    {
      id: "stop_ferry_4",
      order: 9,
      type: "ferry",
      title: "Tarbert to Uig",
      departurePort: {
        label: "Tarbert Ferry Terminal",
        coordinates: { lat: 57.8967, lng: -6.8016 },
      },
      arrivalPort: {
        label: "Uig Ferry Terminal",
        coordinates: { lat: 57.585, lng: -6.3475 },
      },
      departureAt: toIsoFromLocalInput("2026-08-13T16:20"),
      arrivalAt: toIsoFromLocalInput("2026-08-13T18:00"),
      checkInBy: toIsoFromLocalInput("2026-08-13T15:35"),
      operator: "CalMac",
      bookingRef: "HEB-TAR-004",
    },
    {
      id: "stop_stay_4",
      order: 10,
      type: "stay",
      title: "Kinloch Campsite",
      place: {
        label: "Kinloch Campsite, Skye",
        coordinates: { lat: 57.1718, lng: -5.8975 },
      },
      checkInAt: toIsoFromLocalInput("2026-08-13T19:00"),
      checkOutAt: toIsoFromLocalInput("2026-08-15T08:30"),
      costPerNight: 42,
    },
    {
      id: "stop_poi_4",
      order: 11,
      type: "point_of_interest",
      title: "Old Man of Storr",
      place: {
        label: "Old Man of Storr, Skye",
        coordinates: { lat: 57.5066, lng: -6.1814 },
      },
      visitDate: "2026-08-14",
      notes: "Early morning hike before checkout day.",
    },
  ],
};

export const getSeedData = (): AppDataV1 => ({
  schemaVersion: 1,
  activeTripId: seedTrip.id,
  trips: [
    {
      ...seedTrip,
      updatedAt: new Date().toISOString(),
    },
  ],
});
