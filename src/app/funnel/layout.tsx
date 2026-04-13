import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Funnel Chart Generator",
  description:
    "Create funnel and conversion charts from your data. Paste stage names and values, style with 30+ themes, and export as high-quality images.",
  openGraph: {
    title: "Funnel Chart Generator | PastePretty",
    description: "Build polished funnel charts for conversion flows, sales pipelines, and more. Customizable and exportable.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
