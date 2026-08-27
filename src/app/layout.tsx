import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vaatelier.online";
const SITE_TITLE = "The VA Atelier | Virtual Assistant Training Program";
const SITE_DESCRIPTION =
  "A boutique, one-on-one training program for aspiring Virtual Assistants: video lessons, quizzes, a required live coaching session, and a personally signed certificate of completion.";

// The image shown when the site link is shared on Messenger, SMS/RCS,
// Facebook, LinkedIn, etc. Without this, those apps fall back to guessing an
// image from the page content (which was picking up the trainer's headshot
// photo from the "Meet Your Trainer" section - not the intended preview).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "The VA Atelier",
    images: [{ url: "/og-image.png", width: 1254, height: 1254, alt: SITE_TITLE }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
