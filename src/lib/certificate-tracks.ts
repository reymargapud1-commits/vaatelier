/**
 * The VA Atelier awards 4 separate certificates per training niche, each
 * covering a group of modules, instead of a single certificate for the
 * whole course. A student earns each certificate independently, as soon as
 * they finish every lesson and pass every quiz in that track's modules - no
 * live coaching session required (that is a separate, optional paid
 * add-on).
 *
 * Every niche (= one course, see content/niches.json) gets its own 4 tracks
 * below, using that niche's own module ids from its curriculum JSON. The 4
 * track ids ("foundations" / "core-skills" / "portfolio" / "client-launch")
 * are shared across every niche on purpose - it's what a student's first,
 * second, third, and fourth certificate are called, regardless of which
 * niche they're in - so certificates/trackFeedback rows for different
 * niches never collide (they're scoped by courseId + track together).
 *
 * When adding a new niche, add its own entry here with 4 tracks that
 * together cover every module id in its curriculum - see "Training niches"
 * in the README.
 */
export interface CertificateTrack {
  id: string;
  label: string;
  subtitle: string;
  moduleIds: string[];
}

const TRACKS_BY_COURSE: Record<string, CertificateTrack[]> = {
  "va-foundations": [
    {
      id: "foundations",
      label: "Certificate I: VA Foundations & Essential Tools",
      subtitle: "Modules 1-2",
      moduleIds: ["m1", "m2"],
    },
    {
      id: "core-skills",
      label: "Certificate II: Core VA Skills",
      subtitle: "Module 3",
      moduleIds: ["m3"],
    },
    {
      id: "portfolio",
      label: "Certificate III: Portfolio & Job Application Mastery",
      subtitle: "Modules 4-5",
      moduleIds: ["m4", "m5"],
    },
    {
      id: "client-launch",
      label: "Certificate IV: Client Acquisition & Career Launch",
      subtitle: "Module 6",
      moduleIds: ["m6"],
    },
  ],
  "va-social-media": [
    {
      id: "foundations",
      label: "Certificate I: Social Media VA Foundations & Tools",
      subtitle: "Modules 1-2",
      moduleIds: ["sm-m1", "sm-m2"],
    },
    {
      id: "core-skills",
      label: "Certificate II: Core Social Media Management Skills",
      subtitle: "Module 3",
      moduleIds: ["sm-m3"],
    },
    {
      id: "portfolio",
      label: "Certificate III: Portfolio & Job Application Mastery",
      subtitle: "Modules 4-5",
      moduleIds: ["sm-m4", "sm-m5"],
    },
    {
      id: "client-launch",
      label: "Certificate IV: Client Acquisition & Career Launch",
      subtitle: "Module 6",
      moduleIds: ["sm-m6"],
    },
  ],
};

export function getCertificateTracks(courseId: string): CertificateTrack[] {
  return TRACKS_BY_COURSE[courseId] || [];
}

export function getTrackById(courseId: string, trackId: string): CertificateTrack | undefined {
  return getCertificateTracks(courseId).find((t) => t.id === trackId);
}
