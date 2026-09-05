import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { TickButton } from "@/components/tick-button";
import { TEE_STATUS, NOTIFICATION_KIND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function OutboxPage() {
  const user = await getCurrentUser();
  const [notifications, open, booked] = await Promise.all([
    db.notification.findMany({
      where: user ? { userId: user.id } : {},
      orderBy: { sentAt: "desc" },
      take: 50,
      include: {
        search: { include: { course: { select: { name: true } } } },
        teeTime: { include: { course: { select: { name: true } } } },
      },
    }),
    db.teeTime.count({ where: { status: TEE_STATUS.OPEN } }),
    db.teeTime.count({ where: { status: TEE_STATUS.BOOKED } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">Dev Outbox</h1>
      <p className="mt-1 text-sm text-muted">
        Every alert teetime would send by email/SMS lands here (no provider key configured).
        Tee sheet right now: <b>{open.toLocaleString()}</b> open / {booked.toLocaleString()} booked slots.
      </p>

      <div className="mt-4">
        <TickButton />
      </div>

      <ul className="mt-6 space-y-3">
        {notifications.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            No alerts yet. Create a search on{" "}
            <a href="/find" className="text-crimson underline">
              Find a Tee Time
            </a>
            , then run the simulator a few times.
          </li>
        )}
        {notifications.map((n) => {
          const courseName = n.search?.course.name ?? n.teeTime.course.name;
          const isConfirm = n.kind === NOTIFICATION_KIND.CONFIRM_REQUEST;
          return (
          <li key={n.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                <span
                  className={
                    isConfirm
                      ? "font-semibold text-crimson"
                      : "font-semibold text-blue"
                  }
                >
                  {isConfirm ? "CONFIRM" : "WAITLIST"}
                </span>{" "}
                · {n.channel} · {n.provider} · {courseName}
              </span>
              <span>{n.sentAt.toLocaleString()}</span>
            </div>
            <p className="mt-1 text-sm font-semibold">{n.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-foreground/80">
              {n.body}
            </pre>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
