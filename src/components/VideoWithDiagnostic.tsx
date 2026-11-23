"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A <video> element with a plain-language diagnostic banner that appears
 * the moment playback fails. A blank black rectangle with duration stuck
 * at 0:00 tells a viewer nothing about WHY - missing file on the server?
 * account/payment issue? network problem? This re-requests the exact same
 * stream URL on error and shows what the server actually said back, so a
 * screenshot of the page is enough to diagnose the real cause without
 * anyone needing to open browser dev tools. Shared by the admin curriculum
 * lesson preview and the student-facing lesson player.
 *
 * The server renders `src` straight into the <video> tag, so the browser
 * can start (and sometimes finish failing) the request before React even
 * hydrates and attaches a JS "error" listener - a fast 404 easily loses
 * that race, and a listener attached after the fact never sees an event
 * that already fired. So on mount this checks `video.error` directly in
 * case the failure already happened, in addition to listening for one that
 * hasn't happened yet - covering both timings.
 */
export default function VideoWithDiagnostic({
  src,
  onEnded,
  lessonKey,
}: {
  src: string;
  onEnded?: () => void;
  lessonKey?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  useEffect(() => {
    setDiagnostic(null);
    const video = videoRef.current;
    if (!video) return;

    async function diagnose() {
      try {
        const res = await fetch(src, { method: "GET", cache: "no-store" });
        const text = (await res.text().catch(() => "")).trim();
        if (res.ok) {
          setDiagnostic(
            `The server responded normally (status ${res.status}), but the browser still couldn't play it. ` +
              `This usually means the video file itself has a problem (empty, corrupted, or in a format this ` +
              `browser can't play) rather than it being missing.`
          );
        } else {
          setDiagnostic(`The server said "${text || res.statusText}" (status ${res.status}).`);
        }
      } catch {
        setDiagnostic(
          "Couldn't reach the server at all to check - this looks like a network/connection problem rather than a missing file."
        );
      }
    }

    video.addEventListener("error", diagnose);
    if (video.error) {
      // Already failed before this listener could attach - diagnose now,
      // since the event that would normally trigger this already fired.
      diagnose();
    }

    return () => video.removeEventListener("error", diagnose);
  }, [src]);

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        key={lessonKey}
        controls
        controlsList="nodownload"
        className="aspect-video w-full"
        onEnded={onEnded}
        src={src}
      />
      {diagnostic && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">This video didn't load. Here's why:</p>
          <p className="mt-1">{diagnostic}</p>
        </div>
      )}
    </>
  );
}
