import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Command Center Beta",
  description: "A retro-inspired desktop app to manage, monitor, and orchestrate your AI coding agents.",
  keywords: ["Claude Command Center", "Claude", "Codex", "Gemini", "AI", "Agent", "Manager", "Claude Code"],
  icons: { icon: "/claude-command-center/favicon-32.png", apple: "/claude-command-center/icon-192.png" },
  openGraph: {
    title: "Claude Command Center Beta",
    description: "A retro-inspired desktop app to manage and orchestrate your AI coding agents.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}<Analytics /></body>
    </html>
  );
}
