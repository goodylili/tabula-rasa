import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const siteUrl = "https://pastepretty.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PastePretty — Paste Data, Get Beautiful Visualizations",
    template: "%s | PastePretty",
  },
  description:
    "Paste JSON, CSV, Markdown, or SQL data and instantly transform it into stunning tables, charts, heatmaps, treemaps, and more. 30+ themes. Export as PNG, SVG, or data formats. Free, open-source, fully client-side.",
  keywords: [
    "data visualization",
    "table to image",
    "chart generator",
    "CSV to chart",
    "JSON to image",
    "markdown table",
    "heatmap generator",
    "treemap",
    "scatter plot",
    "funnel chart",
    "data to image",
    "beautiful tables",
    "code screenshot",
    "paste data",
    "export chart PNG",
    "data presentation",
    "open source visualization",
  ],
  authors: [{ name: "Goodness", url: siteUrl }],
  creator: "Goodness",
  publisher: "PastePretty",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "PastePretty",
    title: "PastePretty — Paste Data, Get Beautiful Visualizations",
    description:
      "Transform raw data into polished visualizations in seconds. Tables, bar charts, pie charts, scatter plots, heatmaps, treemaps, and more. 30+ themes, fully customizable, export anywhere.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PastePretty — Paste Data, Get Beautiful Visualizations",
    description:
      "Paste JSON, CSV, or Markdown and get stunning charts and tables instantly. 30+ themes, export as PNG/SVG. Free and open-source.",
    creator: "@goodaborode",
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Fira+Code:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Roboto+Mono:wght@400;500;600;700&family=Inconsolata:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Arimo:wght@400;500;600;700&family=Nunito+Sans:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Lato:wght@400;700&family=Rubik:wght@400;500;600;700&family=Ubuntu+Mono:wght@400;700&family=Anonymous+Pro:wght@400;700&family=Cousine:wght@400;700&family=PT+Mono&family=Overpass+Mono:wght@400;500;600;700&family=Noto+Sans+Mono:wght@400;500;600;700&family=Red+Hat+Mono:wght@400;500;600;700&family=Martian+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "PastePretty",
              url: siteUrl,
              description:
                "Paste JSON, CSV, Markdown, or SQL data and instantly transform it into stunning tables, charts, heatmaps, treemaps, and more.",
              applicationCategory: "DesignApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "Table visualization",
                "Bar, line, and pie charts",
                "Scatter plots",
                "Heatmaps",
                "Treemaps",
                "Funnel charts",
                "Area charts",
                "Stat cards",
                "30+ built-in themes",
                "Export as PNG, SVG, JPG",
                "Custom backgrounds and colors",
                "Fully client-side processing",
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
