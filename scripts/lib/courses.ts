import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONS, regionMeta } from "./regions";

export type ParsedCourse = {
  name: string;
  slug: string;
  region: string;
  country: string;
  /** physical site name shared by "Course - Variant" rows, used for geocoding */
  siteKey: string;
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['".]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Strip a trailing " - <Variant>" / known suffixes to group multi-course sites.
function deriveSiteName(name: string): string {
  let n = name;
  // "Foo - Bar" -> "Foo"  (but keep names that are just hyphenated words rare here)
  const dashIdx = n.indexOf(" - ");
  if (dashIdx > 0) n = n.slice(0, dashIdx);
  n = n
    .replace(/\b(Back 9|18|9 Hole|9|\(9 Holes\)|Members?|Residents?|Public|Non-Resident|Social Members)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return n || name;
}

export function parseCourses(): ParsedCourse[] {
  const raw = readFileSync(join(process.cwd(), "data", "courses-raw.txt"), "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const out: ParsedCourse[] = [];
  let region = "";
  const seenSlugs = new Set<string>();

  for (const line of lines) {
    if (REGIONS[line]) {
      region = line;
      continue;
    }
    if (!region) continue;
    const country = regionMeta(region).country;
    let slug = slugify(line);
    if (seenSlugs.has(slug)) slug = `${slug}-${slugify(region)}`;
    let i = 2;
    while (seenSlugs.has(slug)) slug = `${slugify(line)}-${slugify(region)}-${i++}`;
    seenSlugs.add(slug);
    out.push({
      name: line,
      slug,
      region,
      country,
      siteKey: `${deriveSiteName(line)}|${region}`,
    });
  }
  return out;
}
