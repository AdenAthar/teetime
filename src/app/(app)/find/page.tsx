import { getCourses, groupByRegion } from "@/lib/courses";
import { getUserId } from "@/lib/auth/session";
import { CourseMap } from "@/components/course-map";
import { CourseDirectory } from "@/components/course-directory";

export const dynamic = "force-dynamic";

export default async function FindPage() {
  const [courses, userId] = await Promise.all([getCourses(), getUserId()]);
  const groups = groupByRegion(courses);
  const signedIn = Boolean(userId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-center text-4xl font-bold tracking-tight text-foreground sm:text-[2.75rem]">
        teetime Courses
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] text-muted">
        Check the map below to find courses near you that are committed to making it easier for
        golfers to play more golf.
      </p>

      <div className="relative isolate z-0 mt-8 overflow-hidden rounded-[14px] border border-border">
        <CourseMap pins={courses} />
      </div>

      <p className="mt-2 text-right text-xs text-muted">
        {courses.length.toLocaleString()} courses across {groups.length} states &amp; provinces
      </p>

      <div className="mt-8">
        <CourseDirectory groups={groups} signedIn={signedIn} />
      </div>
    </div>
  );
}
