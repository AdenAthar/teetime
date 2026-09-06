/**
 * teetime MCP server — exposes a few read-only slices of teetime as Model
 * Context Protocol tools, over stdio.
 *
 *   Run:      npm run mcp
 *   Connect:  see README → "MCP server"
 *
 * stdio transport uses stdout for JSON-RPC framing, so every log line in this
 * process goes to stderr (console.error). The shared Prisma client
 * (`@/lib/db`) logs errors only, also to stderr, outside NODE_ENV=development.
 *
 * All three tools are read-only by design — see ARCHITECTURE.md §"MCP server"
 * for why. They wrap the same Prisma models the app uses; there is no separate
 * data path.
 */
import "dotenv/config"; // so `npm run mcp` picks up .env like the other scripts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { TEE_STATUS } from "@/lib/constants";
import {
  dateAtMidnight,
  minutesToLabel,
  minutesFromMidnight,
  formatDollars,
} from "@/lib/time";

const server = new McpServer({ name: "teetime", version: "0.1.0" });

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function notFound(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

server.registerTool(
  "search_courses",
  {
    title: "Search golf courses",
    description:
      "Find golf courses in the teetime directory by name or by location " +
      "(US state / Canadian province). Returns up to 25 matches with their " +
      "id, name, region, country, simulated booking provider and booking URL. " +
      "Pass a returned `id` to `check_availability` or use it to make sense of " +
      "a search from `get_search_status`.",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe(
          "Part of a course name or a region name, e.g. \"Pebble\", \"Bethpage\", \"Arizona\", \"Ontario\"",
        ),
    },
  },
  async ({ query }) => {
    const q = query.trim();
    const courses = await db.course.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { region: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ region: "asc" }, { name: "asc" }],
      take: 25,
      select: {
        id: true,
        name: true,
        region: true,
        country: true,
        provider: true,
        bookingUrl: true,
      },
    });
    return json({ query: q, count: courses.length, courses });
  },
);

server.registerTool(
  "check_availability",
  {
    title: "Check tee-time availability",
    description:
      "List the OPEN (bookable) tee-time slots for one course on one calendar " +
      "day (UTC). Each slot has a time, the number of players it can take, " +
      "holes, and price per player. An empty list means nothing is open for " +
      "that day — teetime is a simulator that only holds a tee sheet for a " +
      "course while someone is actively watching it, so unwatched courses " +
      "return no slots.",
    inputSchema: {
      courseId: z.string().min(1).describe("A course id from `search_courses`"),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
        .describe("The calendar day to check, e.g. \"2026-09-12\""),
    },
  },
  async ({ courseId, date }) => {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true, region: true },
    });
    if (!course) return notFound(`No course with id "${courseId}".`);

    const dayStart = dateAtMidnight(new Date(`${date}T00:00:00Z`));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const slots = await db.teeTime.findMany({
      where: {
        courseId,
        status: TEE_STATUS.OPEN,
        teeAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { teeAt: "asc" },
      select: { teeAt: true, players: true, holes: true, priceCents: true },
    });

    return json({
      course,
      date,
      openSlots: slots.length,
      slots: slots.map((s) => ({
        time: minutesToLabel(minutesFromMidnight(s.teeAt)),
        teeAt: s.teeAt.toISOString(),
        playersAvailable: s.players,
        holes: s.holes,
        pricePerPlayer: formatDollars(s.priceCents),
      })),
    });
  },
);

server.registerTool(
  "get_search_status",
  {
    title: "Get a teetime search's status",
    description:
      "Look up one saved teetime search by id and return its current status — " +
      "ACTIVE (watching), PAUSED (notifications stopped), MATCHED (a slot was " +
      "found), or EXPIRED (the watched date has passed) — the course and time " +
      "window it watches, and any alerts already sent for it.",
    inputSchema: {
      searchId: z
        .string()
        .min(1)
        .describe("A search id (shown on the app's My Searches page)"),
    },
  },
  async ({ searchId }) => {
    const s = await db.search.findUnique({
      where: { id: searchId },
      include: {
        course: { select: { name: true, region: true } },
        notifications: {
          orderBy: { sentAt: "desc" },
          include: { teeTime: { select: { teeAt: true, priceCents: true } } },
        },
      },
    });
    if (!s) return notFound(`No search with id "${searchId}".`);

    return json({
      id: s.id,
      status: s.status,
      recurring: s.recurring,
      course: s.course.name,
      region: s.course.region,
      date: s.date.toISOString().slice(0, 10),
      window: `${minutesToLabel(s.startMin)}–${minutesToLabel(s.endMin)}`,
      players: s.players,
      holes: s.holes,
      alerts: s.notifications.map((n) => ({
        kind: n.kind,
        channel: n.channel,
        sentAt: n.sentAt.toISOString(),
        teeAt: n.teeTime.teeAt.toISOString(),
        pricePerPlayer: formatDollars(n.teeTime.priceCents),
        subject: n.subject,
      })),
    });
  },
);

async function main() {
  await server.connect(new StdioServerTransport());
  console.error("teetime MCP server ready on stdio (tools: search_courses, check_availability, get_search_status)");
}

main().catch((err) => {
  console.error("teetime MCP server failed to start:", err);
  process.exit(1);
});
