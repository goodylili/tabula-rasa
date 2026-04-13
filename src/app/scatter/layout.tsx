import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scatter Plot Generator",
  description:
    "Create beautiful scatter plots from your data. Paste CSV, JSON, or tabular data, pick a theme, customize colors, and export as PNG or SVG.",
  openGraph: {
    title: "Scatter Plot Generator | PastePretty",
    description: "Turn raw data into polished scatter plots with grouping, custom colors, and 30+ themes.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
