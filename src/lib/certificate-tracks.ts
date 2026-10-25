// Each niche (course) has exactly 4 certificate tracks, grouping its 6
// modules the same way across every niche (every curriculum follows the
// same 6-module shape - see content/curriculum/<courseId>.json): the
// opening two modules (getting started + tools) earn Certificate I, the
// core skills module stands alone as Certificate II, the portfolio +
// resume modules together earn Certificate III, and landing the first
// client is its own capstone Certificate IV.
//
// RECONSTRUCTION NOTE: this file was rebuilt from scratch after the
// original was lost (see repo history) - the module→track grouping below
// is a reasonable, consistent re-derivation from each course's module
// titles/order, not recovered data. If your students had already-issued
// certificates referencing different track IDs, double check
// certificates.track values in the database against this file's `id`s.
//
// "Adding another niche" in the README: add a matching 4-track entry here
// for the new courseId, covering every module in its curriculum.

export interface CertificateTrack {
  id: string;
  label: string;
  subtitle: string;
  moduleIds: string[];
}

const CERTIFICATE_TRACKS: Record<string, CertificateTrack[]> = {
  "va-foundations": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["m1", "m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["m4", "m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["m6"] },
  ],
  "va-social-media": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["sm-m1", "sm-m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["sm-m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["sm-m4", "sm-m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["sm-m6"] },
  ],
  "va-ecommerce": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["ec-m1", "ec-m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["ec-m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["ec-m4", "ec-m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["ec-m6"] },
  ],
  "va-medical": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["med-m1", "med-m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["med-m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["med-m4", "med-m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["med-m6"] },
  ],
  "va-bookkeeping": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["bk-m1", "bk-m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["bk-m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["bk-m4", "bk-m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["bk-m6"] },
  ],
  "va-real-estate": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["re-m1", "re-m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["re-m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["re-m4", "re-m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["re-m6"] },
  ],
  "va-ai": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["ai-m1", "ai-m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["ai-m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["ai-m4", "ai-m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["ai-m6"] },
  ],
  "va-ai-automation": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["aa-m1", "aa-m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["aa-m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["aa-m4", "aa-m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["aa-m6"] },
  ],
  "va-ai-content": [
    { id: "track1", label: "Certificate I: Getting Started", subtitle: "Foundations & Essential Tools", moduleIds: ["ac-m1", "ac-m2"] },
    { id: "track2", label: "Certificate II: Core Skills", subtitle: "Core Training Mastery", moduleIds: ["ac-m3"] },
    { id: "track3", label: "Certificate III: Portfolio & Job Prep", subtitle: "Portfolio, Resume & Job Applications", moduleIds: ["ac-m4", "ac-m5"] },
    { id: "track4", label: "Certificate IV: Landing Clients", subtitle: "Landing Your First Client", moduleIds: ["ac-m6"] },
  ],
};

export function getTracksForCourse(courseId: string): CertificateTrack[] {
  return CERTIFICATE_TRACKS[courseId] || [];
}

export function getTrackById(courseId: string, trackId: string): CertificateTrack | undefined {
  return getTracksForCourse(courseId).find((t) => t.id === trackId);
}
