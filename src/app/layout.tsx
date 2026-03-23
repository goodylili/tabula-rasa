import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tabula Rasa — Beautiful Table Visualizations",
  description: "Transform JSON or Markdown tables into beautiful, themed images. Like Ray.so but for tables.",
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
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
