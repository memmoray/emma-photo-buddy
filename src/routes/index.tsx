import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, MapPin } from "lucide-react";

import emmaPortrait from "@/assets/emma.jpg";
import locBarton from "@/assets/loc-barton.jpg";
import locGreenbelt from "@/assets/loc-greenbelt.jpg";
import locZilker from "@/assets/loc-zilker.jpg";
import pkgCouples from "@/assets/pkg-couples.jpg";
import pkgFamily from "@/assets/pkg-family.jpg";
import pkgPortrait from "@/assets/pkg-portrait.jpg";
import { EmmaChat } from "@/components/EmmaChat";
import { askEmma, readSessionKey } from "@/lib/session";
import { PACKAGES, LOCATIONS } from "@/lib/studio-data";
import { getAvailability, getLatestBooking } from "@/lib/studio.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Emma · Golden Hour ATX Photography" },
      {
        name: "description",
        content:
          "Chat with Emma, the virtual studio manager for Golden Hour ATX Photography in Austin. Packages, locations, availability and booking in one conversation.",
      },
      { property: "og:title", content: "Emma · Golden Hour ATX Photography" },
      {
        property: "og:description",
        content:
          "Austin golden-hour portrait, family and couples sessions, booked through a short conversation with Emma.",
      },
    ],
  }),
  component: Index,
});

const PACKAGE_IMAGES: Record<string, string> = {
  portrait: pkgPortrait,
  family: pkgFamily,
  couples: pkgCouples,
};

const LOCATION_IMAGES: Record<string, string> = {
  "barton-springs": locBarton,
  "zilker-hill": locZilker,
  greenbelt: locGreenbelt,
};

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
      {children}
    </p>
  );
}

function Availability() {
  const availability = useQuery({
    queryKey: ["availability"],
    queryFn: () => getAvailability(),
  });

  return (
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-cream/70">
      <div className="grid grid-cols-1 divide-y divide-border/70">
        {(availability.data?.days ?? []).map((day) => (
          <div key={day.date} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="w-24 shrink-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {day.weekday}
              </p>
              <p className="font-display text-lg">{day.label}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {day.times.map((slot) =>
                slot.open ? (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() =>
                      askEmma(
                        `I'd like to book ${day.weekday} ${day.label} at ${slot.time}. What do you need from me?`,
                      )
                    }
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {slot.time}
                  </button>
                ) : (
                  <span
                    key={slot.time}
                    className="rounded-full border border-border/50 px-3 py-1.5 text-xs text-muted-foreground line-through"
                  >
                    {slot.time}
                  </span>
                ),
              )}
            </div>
          </div>
        ))}
        {availability.isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading the studio calendar…</p>
        ) : null}
      </div>
    </div>
  );
}

function Confirmation({ refreshKey }: { refreshKey: number }) {
  const sessionKey = readSessionKey();
  const booking = useQuery({
    queryKey: ["booking", sessionKey, refreshKey],
    queryFn: () => getLatestBooking({ data: { sessionKey: sessionKey as string } }),
    enabled: Boolean(sessionKey),
  });

  const data = booking.data?.booking;

  if (!data) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-cream/40 px-6 py-10 text-center">
        <p className="font-display text-xl italic">No session on the books yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Once you and Emma settle on a package, a location and a time, your confirmation appears
          right here.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-rise overflow-hidden rounded-3xl border border-primary/30 bg-cream">
      <div className="flex items-center gap-2 border-b border-border/70 bg-primary/10 px-6 py-3">
        <Check className="size-4 text-primary" />
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
          Confirmed · ref {data.reference}
        </p>
      </div>
      <div className="grid gap-6 px-6 py-7 sm:grid-cols-2">
        <div>
          <p className="font-display text-3xl italic">{data.packageName}</p>
          <p className="mt-1 text-sm text-muted-foreground">${data.price} · {data.location}</p>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
            <dt className="text-muted-foreground">Date</dt>
            <dd>{data.date}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
            <dt className="text-muted-foreground">Time</dt>
            <dd>{data.time}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
            <dt className="text-muted-foreground">Client</dt>
            <dd>{data.clientName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Confirmation sent to</dt>
            <dd className="truncate">{data.clientEmail}</dd>
          </div>
        </dl>
      </div>
      <p className="border-t border-border/70 px-6 py-4 text-xs text-muted-foreground">
        Emma will send a reminder the day before, with the meeting spot and what to wear.
      </p>
    </div>
  );
}

function Index() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((value) => value + 1);

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <div className="leading-tight">
          <p className="font-display text-lg italic">Golden Hour ATX</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Austin, Texas
          </p>
        </div>
        <a
          href="#chat"
          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Talk to Emma
        </a>
      </header>

      <section className="ambient-light border-y border-border/70">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
          <div className="animate-rise">
            <SectionLabel>Your studio manager</SectionLabel>
            <h1 className="mt-5 font-display text-5xl leading-[0.95] md:text-7xl">
              Meet Emma.
              <br />
              <span className="italic text-primary">She books the light.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Emma runs the calendar for Golden Hour ATX, a one-photographer studio shooting Austin's
              last hour of sun. Tell her what you have in mind and she'll handle the package, the
              spot, the time and the confirmation.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#chat"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start the conversation
                <ArrowRight className="size-4" />
              </a>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Usually replies instantly
              </p>
            </div>
          </div>
          <div className="animate-soft relative mx-auto w-full max-w-sm">
            <img
              src={emmaPortrait}
              alt="Emma, the virtual studio manager for Golden Hour ATX Photography"
              width={640}
              height={640}
              className="aspect-square w-full rounded-[2rem] object-cover ring-1 ring-foreground/10"
            />
            <div className="absolute -bottom-5 -left-5 rounded-2xl border border-border bg-cream px-4 py-3 shadow-sm">
              <p className="font-display text-sm italic">"Golden hour is 7:12 tonight."</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Emma · just now
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="chat" className="mx-auto max-w-3xl scroll-mt-10 px-6 py-20">
        <SectionLabel>The conversation</SectionLabel>
        <h2 className="mt-4 font-display text-4xl">Ask Emma anything</h2>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">
          Packages, pricing, where to shoot, what's open this week — and she'll book it for you
          before you leave the page.
        </p>
        <div className="mt-8">
          <EmmaChat onBookingChange={bump} />
        </div>
      </section>

      <section className="border-y border-border/70 bg-cream/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Sessions</SectionLabel>
          <h2 className="mt-4 font-display text-4xl">Three ways to spend the light</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PACKAGES.map((pkg) => (
              <article
                key={pkg.id}
                className={
                  pkg.id === "family"
                    ? "overflow-hidden rounded-3xl border border-primary/40 bg-cream"
                    : "overflow-hidden rounded-3xl border border-border bg-cream"
                }
              >
                <img
                  src={PACKAGE_IMAGES[pkg.id]}
                  alt={`${pkg.name} session by Golden Hour ATX`}
                  width={1024}
                  height={768}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="space-y-3 p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-2xl italic">{pkg.name}</h3>
                    <span className="font-mono text-sm">${pkg.price}</span>
                  </div>
                  {pkg.id === "family" ? (
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                      Emma's pick
                    </p>
                  ) : null}
                  <p className="text-sm leading-relaxed text-muted-foreground">{pkg.blurb}</p>
                  <button
                    type="button"
                    onClick={() => askEmma(`Tell me more about ${pkg.name} session.`)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
                  >
                    Ask Emma about this
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>Locations</SectionLabel>
        <h2 className="mt-4 font-display text-4xl">Where the light lands</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {LOCATIONS.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => askEmma(`What's a session at ${loc.name} like?`)}
              className="group overflow-hidden rounded-3xl border border-border bg-cream text-left transition-colors hover:border-primary/40"
            >
              <img
                src={LOCATION_IMAGES[loc.id]}
                alt={`${loc.name} in Austin at golden hour`}
                width={1024}
                height={768}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="space-y-2 p-6">
                <h3 className="flex items-center gap-2 font-display text-xl italic">
                  <MapPin className="size-4 text-primary" />
                  {loc.name}
                </h3>
                <p className="text-sm text-muted-foreground">{loc.blurb}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="border-y border-border/70 bg-cream/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionLabel>Availability</SectionLabel>
          <h2 className="mt-4 font-display text-4xl">Open golden hours</h2>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">
            Pick a time and Emma will pick up the conversation from there.
          </p>
          <div className="mt-10">
            <Availability />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <SectionLabel>Confirmation</SectionLabel>
        <h2 className="mt-4 font-display text-4xl">Your session</h2>
        <div className="mt-10">
          <Confirmation refreshKey={refreshKey} />
        </div>
      </section>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
          <p className="font-display text-lg italic">Golden Hour ATX Photography</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Austin, Texas · by appointment
          </p>
        </div>
      </footer>
    </main>
  );
}
