import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stat Card Generator",
  description:
    "Create beautiful KPI and metric stat cards from your data. Paste values and labels, choose a theme, and export as shareable images.",
  openGraph: {
    title: "Stat Card Generator | PastePretty",
    description: "Turn metrics and KPIs into polished stat cards ready for dashboards, presentations, and reports.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
