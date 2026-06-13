import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weather Dress",
  description: "Weather-aware outfit recommendations from your wardrobe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
