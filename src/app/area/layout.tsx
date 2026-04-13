import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Area Chart Generator",
  description:
    "Generate beautiful area charts from tabular data. Paste your data, customize fill colors and gradients, and export as PNG or SVG.",
  openGraph: {
    title: "Area Chart Generator | PastePretty",
    description: "Create polished area charts with gradient fills, multiple series, and 30+ built-in themes.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
