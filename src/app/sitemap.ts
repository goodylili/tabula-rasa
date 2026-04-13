import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://pastepretty.com";
  const lastModified = new Date();

  return [
    { url: baseUrl, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/scatter`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/heatmap`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/treemap`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/funnel`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/area`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/stat-card`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/comparison`, lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}
