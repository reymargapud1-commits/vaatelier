/**
 * The VA Atelier awards 4 separate certificates, each covering a group of
 * modules, instead of a single certificate for the whole course. A student
 * earns each certificate independently, as soon as they finish every lesson
 * and pass every quiz in that track's modules - no live coaching session
 * required (that is a separate, optional paid add-on).
 *
 * moduleIds must reference content/curriculum.json module ids.
 */
export interface CertificateTrack {
  id: string;
  label: string;
  subtitle: string;
  moduleIds: string[];
}

export const CERTIFICATE_TRACKS: CertificateTrack[] = [
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
];

export function getTrackById(trackId: string): CertificateTrack | undefined {
  return CERTIFICATE_TRACKS.find((t) => t.id === trackId);
}
