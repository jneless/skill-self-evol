import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skill Self Evolution",
  description:
    "A single-tenant baseline for evaluating and evolving Codex skills.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
