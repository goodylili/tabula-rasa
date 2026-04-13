import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparison Card Generator",
  description:
    "Build side-by-side comparison cards from tabular data. Paste features, specs, or metrics, pick a theme, and export as beautiful images.",
  openGraph: {
    title: "Comparison Card Generator | PastePretty",
    description: "Create polished comparison cards for products, features, or metrics. Themed, customizable, and exportable.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
