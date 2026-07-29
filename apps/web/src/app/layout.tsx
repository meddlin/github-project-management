import type { Metadata } from "next";
import { AppNavigation } from "./app-navigation";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
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
