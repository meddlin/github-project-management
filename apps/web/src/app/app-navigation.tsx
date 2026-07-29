"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const navigationItems = [
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
    <header className="border-b bg-background">
      <div className="mx-[5%] flex items-center justify-between py-4">
        <Link className="text-sm font-semibold text-foreground" href="/">
          GitHub Project Management
        </Link>
        <div className="flex items-center gap-2">
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-1 rounded-md border bg-card p-1"
          >
            {navigationItems.map((item) => {
              const isActive = item.match(pathname);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
      </div>
    </header>
  );
}
