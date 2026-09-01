import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses } from "@/db/schema";
import niches from "../../../../../content/niches.json";

/**
 * Sets the logged-in student's training niche (users.courseId) - the one
 * choice a student makes right after enrolling, before any lesson unlocks.
 * A student can only pick once: courseId being non-null already means they
 * picked before, so this refuses to change it (there's no "switch niches"
 * flow yet - see README "Training niches" for why).
 *
 * Handles TWO request shapes on purpose. NichePicker submits each card as a
 * real HTML <form> (application/x-www-form-urlencoded) with a JS onClick
 * that upgrades it to a JSON fetch when React has actually hydrated. If
 * hydration ever fails silently (a blocked script, a stale cached bundle, a
 * client-side error elsewhere on the page) the onClick never attaches and
 * the plain form submission still lands here and still works - the browser
 * does a normal POST + redirect instead of a JSON response. That's what
 * stops a click from ever doing nothing.
 */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const isFormSubmit =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  function fail(message: string, status: number) {
    if (isFormSubmit) {
      const url = new URL("/dashboard/choose-niche", req.url);
      url.searchParams.set("error", message);
      return NextResponse.redirect(url, { status: 303 });
    }
    return NextResponse.json({ error: message }, { status });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    if (isFormSubmit) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isPaid) {
    return fail("Payment required", 402);
  }
  if (user.courseId) {
    // Already chosen - a stale/duplicate form submit (e.g. double click, or
    // the JS path already succeeded and this is a leftover native submit)
    // should just land them on their dashboard rather than show an error.
    if (isFormSubmit) {
      return NextResponse.redirect(new URL("/dashboard", req.url), { status: 303 });
    }
    return NextResponse.json({ error: "You've already chosen a training niche" }, { status: 400 });
  }

  let courseId: string;
  if (isFormSubmit) {
    const form = await req.formData();
    courseId = String(form.get("courseId") || "");
  } else {
    const body = (await req.json()) as { courseId: string };
    courseId = body.courseId;
  }

  const niche = niches.niches.find((n) => n.courseId === courseId && n.isPublished);
  if (!niche) {
    return fail("Unknown or unavailable training niche", 400);
  }

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) {
    return fail("This niche's content isn't seeded yet", 400);
  }

  await db.update(users).set({ courseId }).where(eq(users.id, userId));

  if (isFormSubmit) {
    return NextResponse.redirect(new URL("/dashboard", req.url), { status: 303 });
  }
  return NextResponse.json({ success: true, courseId });
}
