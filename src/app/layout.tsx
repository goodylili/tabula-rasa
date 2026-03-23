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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
