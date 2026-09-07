import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { findCourses } from "@/lib/courses";
import { isoDate, minutesToLabel } from "@/lib/time";
import { WINDOW_DAYS, MAX_DRAFTS, expandDays, normalizeWindow } from "@/lib/ai/draft-math";

/**
 * Natural-language → structured search drafts.
 *
 * The model only *extracts* fields (course/area, dates, time window, party) — it
 * never touches the database. We resolve the course text against Postgres here,
 * expand any date range, and hand back plain drafts that the user reviews and
 * submits through the normal `createSearch` action. No autonomous writes.
 */

export const AI_SEARCH_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY);

export type SearchDraft = {
  courseId: string;
  courseName: string;
  region: string;
  date: string; // yyyy-mm-dd
  startMin: number;
  endMin: number;
  players: number;
  holes: 9 | 18;
};

export type ParseResult =
  | { ok: true; drafts: SearchDraft[]; note: string }
  | { ok: false; error: string };

const extraction = z.object({
  courseQuery: z
    .string()
    .describe(
      "The golf course name or the US state / Canadian province the golfer named. Empty string if they named neither.",
    ),
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.number().int(),
  endMin: z.number().int(),
  players: z.number().int().min(1).max(4),
  holes: z.union([z.literal(9), z.literal(18)]),
  note: z.string(),
});

const TOOL: Anthropic.Tool = {
  name: "propose_search",
  description: "Return the structured tee-time search the golfer described.",
  input_schema: {
    type: "object",
    properties: {
      courseQuery: {
        type: "string",
        description:
          "Course name or US state / Canadian province the golfer named (e.g. \"Pebble Beach\", \"Arizona\"). Empty string if neither was mentioned.",
      },
      dateStart: { type: "string", description: "First day to watch, YYYY-MM-DD." },
      dateEnd: {
        type: "string",
        description: "Last day to watch, YYYY-MM-DD. Same as dateStart for a single day.",
      },
      startMin: {
        type: "integer",
        description:
          "Earliest acceptable tee time, minutes from midnight. morning≈420-660, midday≈660-900, afternoon≈720-960, twilight/evening≈960-1140. Default 420.",
      },
      endMin: {
        type: "integer",
        description: "Latest acceptable tee time, minutes from midnight. Default 660.",
      },
      players: { type: "integer", description: "Party size 1-4. Default 2." },
      holes: { type: "integer", enum: [9, 18], description: "9 or 18. Default 18." },
      note: {
        type: "string",
        description: "One short sentence paraphrasing what you understood, for the golfer to confirm.",
      },
    },
    required: [
      "courseQuery",
      "dateStart",
      "dateEnd",
      "startMin",
      "endMin",
      "players",
      "holes",
      "note",
    ],
  },
};

export async function parseSearchPrompt(prompt: string): Promise<ParseResult> {
  const text = prompt.trim();
  if (!AI_SEARCH_ENABLED) return { ok: false, error: "Natural-language search is not configured." };
  if (text.length < 3) return { ok: false, error: "Tell me a bit more about the tee time you want." };
  if (text.length > 300) return { ok: false, error: "That's a lot — try a shorter description." };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const anthropic = new Anthropic();
  let raw: unknown;
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:
        `You turn a golfer's request into one tee-time search for the "teetime" app. ` +
        `Today is ${isoDate(today)} (UTC). Searches watch a single course and a date ` +
        `window up to ${WINDOW_DAYS} days out; clamp anything further. Courses are in ` +
        `the US and Canada. If the golfer gives a date range or says e.g. "this weekend", ` +
        `set dateStart/dateEnd to span it. Resolve weekdays/"weekend"/"tomorrow" against ` +
        `today's date. Defaults when unspecified: 2 players, 18 holes, 7:00-11:00am window.`,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "propose_search" },
      messages: [{ role: "user", content: text }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return { ok: false, error: "Couldn't read that — try rephrasing." };
    }
    raw = block.input;
  } catch {
    return { ok: false, error: "The assistant is unavailable right now — use the form instead." };
  }

  const parsed = extraction.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Couldn't read that — try rephrasing." };
  const x = parsed.data;

  if (!x.courseQuery.trim()) {
    return {
      ok: false,
      error: "Which course or area? Mention a course name or a state, e.g. \"Torrey Pines\" or \"Arizona\".",
    };
  }

  const [startMin, endMin] = normalizeWindow(x.startMin, x.endMin);

  const courses = await findCourses(x.courseQuery, 3);
  if (courses.length === 0) {
    return { ok: false, error: `No teetime course matches "${x.courseQuery.trim()}".` };
  }

  const days = expandDays(x.dateStart, x.dateEnd, today);
  const drafts: SearchDraft[] = [];
  for (const course of courses) {
    for (const date of days) {
      if (drafts.length >= MAX_DRAFTS) break;
      drafts.push({
        courseId: course.id,
        courseName: course.name,
        region: course.region,
        date,
        startMin,
        endMin,
        players: x.players,
        holes: x.holes,
      });
    }
  }

  const note =
    x.note.trim() ||
    `${courses.length > 1 ? `${courses.length} courses` : courses[0].name}, ` +
      `${minutesToLabel(startMin)}–${minutesToLabel(endMin)}, ${x.players} player${x.players > 1 ? "s" : ""}.`;

  return { ok: true, drafts, note };
}
