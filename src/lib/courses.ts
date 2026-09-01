import "server-only";
import { db } from "@/lib/db";

export type CoursePin = {
  id: string;
  name: string;
  slug: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  bookingUrl: string | null;
  provider: string | null;
};

export type RegionGroup = { region: string; country: string; courses: CoursePin[] };

export async function getCourses(): Promise<CoursePin[]> {
  return db.course.findMany({
    orderBy: [{ region: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      region: true,
      country: true,
      lat: true,
      lng: true,
      bookingUrl: true,
      provider: true,
    },
  });
}

export function groupByRegion(courses: CoursePin[]): RegionGroup[] {
  const map = new Map<string, RegionGroup>();
  for (const c of courses) {
    let g = map.get(c.region);
    if (!g) {
      g = { region: c.region, country: c.country, courses: [] };
      map.set(c.region, g);
    }
    g.courses.push(c);
  }
  return [...map.values()].sort((a, b) => a.region.localeCompare(b.region));
}

export async function getCourseBySlug(slug: string) {
  return db.course.findUnique({ where: { slug } });
}
