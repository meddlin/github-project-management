import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description: "GitHub project management across repositories.",
  title: "GitHub Project Management"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
