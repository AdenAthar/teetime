import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AccountShell } from "@/components/account-shell";
import { SearchesView } from "@/components/searches-view";

export const dynamic = "force-dynamic";

export default async function SearchesPage() {
  const user = await requireUser();
  const searches = await db.search.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "asc" }, { startMin: "asc" }],
    include: {
      course: { select: { name: true, region: true, bookingUrl: true } },
      notifications: {
        orderBy: { sentAt: "desc" },
        include: { teeTime: { select: { teeAt: true, priceCents: true } } },
      },
    },
  });

  const view = searches.map((s) => ({
    id: s.id,
    status: s.status,
    recurring: s.recurring,
    daysOfWeek: JSON.parse(s.daysOfWeek || "[]") as number[],
    date: s.date.toISOString(),
    startMin: s.startMin,
    endMin: s.endMin,
    players: s.players,
    holes: s.holes,
    course: s.course,
    notifications: s.notifications.map((n) => ({
      id: n.id,
      subject: n.subject,
      channel: n.channel,
      sentAt: n.sentAt.toISOString(),
      teeAt: n.teeTime.teeAt.toISOString(),
      priceCents: n.teeTime.priceCents,
    })),
  }));

  return (
    <AccountShell active="searches">
      <SearchesView searches={view} />
    </AccountShell>
  );
}
