"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Per-student "Welcome Banner" generator, used from /admin/students. Starts
 * collapsed as a single button; expanding it reveals an optional photo
 * picker and a Generate button. The generated PNG is previewed inline with
 * a real download link (an object URL built from the blob response) - no
 * server-side file is saved, so re-generating (e.g. swapping the photo) is
 * just clicking Generate again.
 */
export default function WelcomeBannerGenerator({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Revoke the previous object URL whenever a new one is created or the
  // component unmounts, so we don't leak memory across repeated generations.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("studentId", studentId);
      if (photo) formData.set("photo", photo);

      const res = await fetch("/api/admin/welcome-banner", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not generate the banner.");
        setGenerating(false);
        return;
      }

      const blob = await res.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setImageUrl(url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-gold-50 px-3 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-100"
      >
        Welcome Banner
      </button>
    );
  }

  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Welcome Banner</p>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Close
        </button>
      </div>

      <label className="mb-2 block text-xs text-gray-500">
        Student photo (optional)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          className="mt-1 block w-full text-xs"
        />
      </label>

      <button
        onClick={generate}
        disabled={generating}
        className="mb-2 w-full rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {generating ? "Generating..." : "Generate"}
      </button>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {imageUrl && (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Welcome banner for ${studentName}`}
            className="w-full rounded-md border border-gray-200"
          />
          <a
            href={imageUrl}
            download={`welcome-${studentName.replace(/\s+/g, "-")}.png`}
            className="w-full rounded-md bg-gold-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-gold-700"
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}
