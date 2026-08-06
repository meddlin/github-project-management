"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const navigationItems = [
  {
    href: "/",
    label: "Overview",
    match: (pathname: string) => pathname === "/"
  },
  {
    href: "/repos",
    label: "Repos",
    match: (pathname: string) =>
      pathname === "/repos" || pathname.startsWith("/repos/") || /^\/[^/]+\/[^/]+\/planning/.test(pathname)
  },
  {
    href: "/projects",
    label: "Projects",
    match: (pathname: string) => pathname === "/projects" || pathname.startsWith("/projects/")
  }
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <header className="border-b">
      <div className="mx-[5%] flex items-center gap-4 py-3">
        <Link className="mr-auto text-lg font-medium tracking-tight text-foreground" href="/">
          GPM
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-4">
          {navigationItems.map((item) => {
            const isActive = item.match(pathname);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`text-sm transition-colors ${
                  isActive ? "text-primary" : "text-foreground hover:text-primary"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
