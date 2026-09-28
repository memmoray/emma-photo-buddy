export type StudioPackage = {
  id: string;
  label: string;
  name: string;
  price: number;
  blurb: string;
};

export type StudioLocation = {
  id: string;
  name: string;
  blurb: string;
};

export const PACKAGES: StudioPackage[] = [
  {
    id: "portrait",
    label: "Portrait",
    name: "The Portrait",
    price: 320,
    blurb: "A focused one-on-one, 45 minutes, 20 edited frames.",
  },
  {
    id: "family",
    label: "Family",
    name: "The Family",
    price: 650,
    blurb: "Up to six people, 90 minutes, 40 edited frames.",
  },
  {
    id: "couples",
    label: "Couples",
    name: "The Couples",
    price: 480,
    blurb: "A relaxed two-person session, 60 minutes, 30 frames.",
  },
];

export const LOCATIONS: StudioLocation[] = [
  {
    id: "barton-springs",
    name: "Barton Springs",
    blurb: "Limestone and still water, best at 6:40pm.",
  },
  {
    id: "zilker-hill",
    name: "Zilker Hill",
    blurb: "Open grass and skyline, soft late light.",
  },
  {
    id: "greenbelt",
    name: "The Greenbelt",
    blurb: "Shaded trails, dappled and gentle.",
  },
];

export const TIME_SLOTS = ["5:30 pm", "6:15 pm", "6:45 pm", "7:10 pm", "7:40 pm", "8:00 pm"];

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function upcomingDates(count = 8) {
  const days: { iso: string; weekday: string; label: string }[] = [];
  const start = new Date();
  for (let i = 1; days.length < count; i += 1) {
    const day = new Date(start.getTime() + i * 86_400_000);
    days.push({
      iso: toISODate(day),
      weekday: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    });
  }
  return days;
}

export function formatSessionDate(iso: string) {
  const day = new Date(`${iso}T12:00:00Z`);
  return day.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
