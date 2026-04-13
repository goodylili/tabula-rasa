import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Heatmap Generator",
  description:
    "Generate color-scaled heatmaps from tabular data. Paste your data, choose a color scale and theme, and export as a high-quality image.",
  openGraph: {
    title: "Heatmap Generator | PastePretty",
    description: "Transform data into beautiful heatmaps with customizable color scales, themes, and export options.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
