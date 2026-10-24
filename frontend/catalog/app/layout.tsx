import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circuit — Everyday electronics",
  description: "Browse the catalog, build your basket, and order through Circuit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
