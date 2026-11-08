import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ytube — Watch what moves you",
  description: "A place to discover, watch, create, and share video.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
