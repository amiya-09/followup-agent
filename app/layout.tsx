import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Follow-up Agent",
  description: "AI sales/founder follow-up agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
