import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, lessons } from "@/db/schema";

// Videos live outside of /public on purpose: this route is the ONLY way to
// reach a lesson video, and it re-checks login + payment status on every
// single request (not just once on page load) before streaming a single
// byte. This is what actually enforces "must pay before accessing content."
const VIDEO_DIR = path.join(process.cwd(), "media", "videos");

export async function GET(req: Request, { params }: { params: { lessonId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, (session.user as any).id))
    .limit(1);
  if (!user || !user.isPaid) {
    return new NextResponse("Payment required", { status: 402 });
  }

  const lessonId = params.lessonId.replace(/[^a-zA-Z0-9-]/g, "");
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(VIDEO_DIR, `${lessonId}.mp4`);
  if (!fs.existsSync(filePath)) {
    return new NextResponse("Video file missing", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.get("range");

  if (!range) {
    const stream = fs.createReadStream(filePath);
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  const chunkSize = end - start + 1;

  const stream = fs.createReadStream(filePath, { start, end });
  return new NextResponse(stream as any, {
    status: 206,
    headers: {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize.toString(),
      "Content-Type": "video/mp4",
      "Cache-Control": "private, no-store",
    },
  });
}
