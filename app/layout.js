import { Inter, Plus_Jakarta_Sans, Archivo } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Archivo — used by the new marketing landing page (app/page.js).
// Kept in the root layout so the font is preloaded on cold navigation.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const SITE_URL = "https://recrewtai.com";
const DESC =
  "Recrewt AI interviews every candidate, asks intelligent follow-up questions, analyzes every response, and gives your team the insights needed to make confident hiring decisions.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Recrewt AI — Meet your AI Hiring Consultant",
  description: DESC,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Recrewt AI",
    title: "Recrewt AI — Meet your AI Hiring Consultant",
    description: DESC,
    url: SITE_URL,
    images: [
      {
        // Purpose-built 1200x630 card — the previous value pointed at the
        // full 2816x1536 hero frame, which social platforms cropped badly.
        url: "/assets/og-recrewt.jpg",
        width: 1200,
        height: 630,
        alt: "A recruiter's desk running Recrewt AI, with candidate paperwork resolving into an organized pipeline.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Recrewt AI — Meet your AI Hiring Consultant",
    description: "Every candidate screened. Before your team spends a minute.",
    images: ["/assets/og-recrewt.jpg"],
  },
};

export const viewport = {
  themeColor: "#111111",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
