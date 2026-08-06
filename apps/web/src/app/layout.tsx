import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppNavigation } from "./app-navigation";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  description: "GitHub project management across repositories.",
  title: "GitHub Project Management"
};

const themeScript = `
try {
  const storedTheme = window.localStorage.getItem("gpm-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : prefersDark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
} catch {}
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={inter.variable} lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
