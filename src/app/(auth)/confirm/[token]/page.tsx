import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { ConfirmActions } from "@/components/confirm-actions";
import { minutesToLabel, minutesFromMidnight, formatDollars } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm your tee time — teetime" };

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const teeTime = await db.teeTime.findUnique({
    where: { confirmToken: token },
    include: { course: true },
  });
  if (!teeTime) notFound();

  const when = teeTime.teeAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const time = minutesToLabel(minutesFromMidnight(teeTime.teeAt));

  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <Logo className="mx-auto" wordClassName="text-[1.6rem]" />
      <h1 className="mt-8 text-xl text-foreground/90">Confirm your tee time</h1>
      <p className="mt-1 text-sm text-muted">
        Let the course know if you&apos;re still coming.
      </p>

      <div className="mt-5 rounded-xl border border-border bg-background p-4 text-left text-sm">
        <p className="font-semibold text-foreground">{teeTime.course.name}</p>
        <p className="text-muted">{teeTime.course.region}</p>
        <p className="mt-2 text-foreground">
          {when} at {time}
        </p>
        <p className="text-muted">
          {teeTime.players} player{teeTime.players === 1 ? "" : "s"} · {teeTime.holes} holes ·{" "}
          {formatDollars(teeTime.priceCents)}/player
        </p>
      </div>

      <ConfirmActions token={token} initialStatus={teeTime.confirmStatus} />
    </div>
  );
}
