import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Area Chart Generator — Paste Data, Export as PNG/SVG",
  description:
    "Free online area chart generator. Paste CSV, JSON, or Markdown data and instantly create beautiful stacked or overlay area charts with gradient fills, 30+ themes, and PNG/SVG export.",
  keywords: [
    "area chart generator",
    "area chart maker",
    "stacked area chart",
    "CSV to area chart",
    "JSON to area chart",
    "gradient area chart",
    "time series chart",
    "export area chart PNG",
    "free chart generator",
  ],
  alternates: { canonical: "/area" },
  openGraph: {
    title: "Area Chart Generator | PastePretty",
    description: "Create polished area charts with gradient fills, multiple series, and 30+ built-in themes.",
    url: "/area",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Area Chart Generator | PastePretty",
    description: "Create polished area charts with gradient fills and multiple series.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
