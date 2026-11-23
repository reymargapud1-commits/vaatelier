import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses } from "@/db/schema";
import { renderWelcomeBanner } from "@/lib/welcome-banner";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB - plenty for a phone photo
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Admin-only: generates a Facebook-postable "Welcome to the family" banner
 * for one enrolled student, with an optional photo (circular crop, gold
 * ring). Called from the /admin/students page. Pure image generation - the
 * PNG is returned directly, nothing is persisted, so re-generating (e.g.
 * with a different photo) is just calling this again.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const studentId = formData.get("studentId");
  const photo = formData.get("photo");

  if (typeof studentId !== "string" || !studentId) {
    return NextResponse.json({ error: "Missing studentId." }, { status: 400 });
  }

  const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }
  if (!student.isPaid) {
    return NextResponse.json({ error: "This student isn't enrolled yet." }, { status: 400 });
  }

  // The student's own niche if they've picked one yet (right after
  // enrolling, before the /dashboard/choose-niche picker, courseId is still
  // null) - falls back to a generic program name in that case.
  let courseTitle = "The VA Atelier Training Program";
  if (student.courseId) {
    const [course] = await db.select().from(courses).where(eq(courses.id, student.courseId)).limit(1);
    if (course) courseTitle = course.title;
  }

  let photoBuffer: Buffer | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_BYTES) {
      return NextResponse.json({ error: "That photo is too large (max 8MB)." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(photo.type)) {
      return NextResponse.json({ error: "Please upload a JPG, PNG, or WEBP photo." }, { status: 400 });
    }
    photoBuffer = Buffer.from(await photo.arrayBuffer());
  }

  try {
    const png = await renderWelcomeBanner({
      studentName: student.name,
      courseTitle,
      photoBuffer,
    });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="welcome-${student.name.replace(/\s+/g, "-")}.png"`,
      },
    });
  } catch (err) {
    console.error("Failed to generate welcome banner:", err);
    return NextResponse.json({ error: "Could not generate the banner. Please try again." }, { status: 500 });
  }
}
