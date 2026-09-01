"use client";

import { useState, useTransition } from "react";
import { clsx } from "@/lib/clsx";
import { InfoIcon } from "./icons";
import { minutesToLabel, formatDollars } from "@/lib/time";
import { pauseSearch, deleteSearch, reactivateSearch } from "@/lib/searches/actions";
import { SimulatorHeartbeat } from "./simulator-heartbeat";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SearchVM = {
  id: string;
  status: string;
  recurring: boolean;
  daysOfWeek: number[];
  date: string;
  startMin: number;
  endMin: number;
  players: number;
  holes: number;
  course: { name: string; region: string; bookingUrl: string | null };
  notifications: {
    id: string;
    subject: string;
    channel: string;
    sentAt: string;
    teeAt: string;
    priceCents: number;
  }[];
};

export function SearchesView({ searches }: { searches: SearchVM[] }) {
  const [tab, setTab] = useState<"all" | "recurring">("all");
  const list = searches.filter((s) => (tab === "recurring" ? s.recurring : !s.recurring));

  return (
    <div>
      <SimulatorHeartbeat />
      <h1 className="flex items-center justify-center gap-2 text-center text-3xl font-semibold text-foreground/90">
        {tab === "recurring" ? "My Recurring Searches" : "My Searches"}
        <InfoIcon className="h-5 w-5 text-muted" />
      </h1>

      <div className="mx-auto mt-6 flex max-w-md overflow-hidden rounded-lg border border-border text-sm font-semibold">
        <button
          onClick={() => setTab("all")}
          className={clsx(
            "flex-1 px-4 py-2.5 uppercase tracking-wide",
            tab === "all" ? "bg-blue-tint text-blue" : "bg-surface text-muted",
          )}
        >
          All Searches
        </button>
        <button
          onClick={() => setTab("recurring")}
          className={clsx(
            "flex-1 px-4 py-2.5 uppercase tracking-wide",
            tab === "recurring" ? "bg-blue-tint text-blue" : "bg-surface text-muted",
          )}
        >
          Recurring Searches
        </button>
      </div>

      {list.length === 0 ? (
        <p className="mt-10 text-center text-[15px] text-muted">
          You do not have any searches for future dates. Create a search and it will show up
          here.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((s) => (
            <SearchCard key={s.id} s={s} />
          ))}
        </ul>
      )}

      <div className="mt-8 flex items-center justify-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted">
          ‹
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-md border border-blue text-blue">
          1
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted">
          ›
        </span>
      </div>
    </div>
  );
}

function SearchCard({ s }: { s: SearchVM }) {
  const [pending, start] = useTransition();
  const date = new Date(s.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const matched = s.status === "MATCHED" || s.notifications.length > 0;

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-foreground">{s.course.name}</p>
          <p className="text-xs text-muted">{s.course.region}</p>
          <p className="mt-1 text-sm text-foreground/80">
            {s.recurring ? (
              <>Weekly · {s.daysOfWeek.map((d) => DOW[d]).join(", ") || "any day"}</>
            ) : (
              date
            )}{" "}
            · {minutesToLabel(s.startMin)}–{minutesToLabel(s.endMin)}
          </p>
          <p className="text-xs text-muted">
            {s.players} player{s.players > 1 ? "s" : ""} · {s.holes} holes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase",
              s.status === "ACTIVE" && "bg-green-100 text-green-700",
              s.status === "PAUSED" && "bg-gray-200 text-gray-600",
              s.status === "MATCHED" && "bg-crimson-tint text-crimson-dark",
              s.status === "EXPIRED" && "bg-gray-100 text-gray-400",
            )}
          >
            {s.status}
          </span>
        </div>
      </div>

      {matched && (
        <div className="mt-3 space-y-2 rounded-xl bg-crimson-tint/60 p-3">
          {s.notifications.slice(0, 3).map((n) => (
            <div key={n.id} className="flex items-center justify-between text-xs">
              <span className="text-crimson-dark">
                🔔 Tee time found ·{" "}
                {new Date(n.teeAt).toLocaleString("en-US", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                · {formatDollars(n.priceCents)}
              </span>
              <span className="text-muted">via {n.channel.toLowerCase()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2 text-xs">
        {s.status === "EXPIRED" ? (
          <button
            onClick={() => start(() => void reactivateSearch(s.id))}
            disabled={pending}
            className="rounded-full border border-border px-3 py-1.5 font-medium"
          >
            Reactivate
          </button>
        ) : (
          <button
            onClick={() => start(() => void pauseSearch(s.id))}
            disabled={pending}
            className="rounded-full border border-border px-3 py-1.5 font-medium"
          >
            {s.status === "PAUSED" ? "Resume" : "Pause"}
          </button>
        )}
        <button
          onClick={() => start(() => void deleteSearch(s.id))}
          disabled={pending}
          className="rounded-full border border-crimson px-3 py-1.5 font-medium text-crimson"
        >
          Delete
        </button>
        {s.course.bookingUrl && (
          <a
            href={s.course.bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded-full bg-crimson px-3 py-1.5 font-medium text-white"
          >
            Book now
          </a>
        )}
      </div>
    </li>
  );
}
