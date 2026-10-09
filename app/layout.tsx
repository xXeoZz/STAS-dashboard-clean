import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STAS Training & Health",
  description: "Private live endurance training and health dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
