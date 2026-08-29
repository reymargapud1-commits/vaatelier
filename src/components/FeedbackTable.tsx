"use client";

import { useMemo, useState } from "react";

export interface FeedbackRow {
  id: string;
  studentName: string;
  studentEmail: string;
  trackLabel: string;
  rating: number;
  comment: string | null;
  createdAt: string; // ISO string - dates don't survive server->client props as Date objects
}

function stars(rating: number) {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(rating);
}

function formatOne(row: FeedbackRow) {
  const lines = [`${stars(row.rating)} — ${row.trackLabel}`];
  if (row.comment) lines.push(`"${row.comment}"`);
  lines.push(`— ${row.studentName}`);
  return lines.join("\n");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
}

/**
 * Coach-facing feedback review table (/admin/feedback). Every "Copy" button
 * puts a ready-to-paste testimonial snippet (stars + quote + student name)
 * on the clipboard - the whole point being that when the coach wants to
 * reuse a piece of feedback somewhere else (a post, a slide, a chat), they
 * don't have to retype or reformat anything.
 */
export default function FeedbackTable({ rows }: { rows: FeedbackRow[] }) {
  const [trackFilter, setTrackFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const trackOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: string[] = [];
    for (const r of rows) {
      if (!seen.has(r.trackLabel)) {
        seen.add(r.trackLabel);
        opts.push(r.trackLabel);
      }
    }
    return opts;
  }, [rows]);

  const filtered = trackFilter === "all" ? rows : rows.filter((r) => r.trackLabel === trackFilter);

  async function copyRow(row: FeedbackRow) {
    try {
      await navigator.clipboard.writeText(formatOne(row));
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 2000);
    } catch {
      // Clipboard API can fail (e.g. insecure context) - nothing critical is
      // lost, the coach can still select/copy the text manually.
    }
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(filtered.map(formatOne).join("\n\n"));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // See copyRow.
    }
  }

  if (rows.length === 0) {
    return <p className="text-gray-500">No feedback submitted yet.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select
          value={trackFilter}
          onChange={(e) => setTrackFilter(e.target.value)}
          className="input !w-auto"
        >
          <option value="all">All certificates</option>
          {trackOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button onClick={copyAll} className="btn-secondary !px-4 !py-2 text-sm">
          {copiedAll ? "Copied!" : `Copy All (${filtered.length})`}
        </button>
      </div>

      <div className="space-y-3">
        {filtered.map((row) => (
          <div key={row.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-amber-400">{stars(row.rating)}</span>
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {row.trackLabel}
                  </span>
                </div>
                {row.comment && <p className="mt-2 text-gray-800">"{row.comment}"</p>}
                <p className="mt-2 text-sm text-gray-500">
                  {row.studentName} ({row.studentEmail}) &middot; {formatDate(row.createdAt)}
                </p>
              </div>
              <button
                onClick={() => copyRow(row)}
                className="shrink-0 rounded-md bg-gold-50 px-3 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-100"
              >
                {copiedId === row.id ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
