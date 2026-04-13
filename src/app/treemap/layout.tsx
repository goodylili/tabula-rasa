import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Treemap Generator",
  description:
    "Build hierarchical treemap visualizations from your data. Paste CSV or JSON, customize cell colors and layout, and export as PNG or SVG.",
  openGraph: {
    title: "Treemap Generator | PastePretty",
    description: "Create stunning treemap visualizations with proportional sizing, custom colors, and 30+ themes.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
