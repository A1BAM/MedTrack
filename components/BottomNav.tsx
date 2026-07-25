"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Log",
    icon: (
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    ),
  },
  {
    href: "/check-in",
    label: "Check-in",
    icon: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4.5V3h6v1.5" strokeLinecap="round" />
        <path d="m8.5 13 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: "/trends",
    label: "Trends",
    icon: (
      <path d="M4 17l5-5 3.5 3.5L20 9m0 0h-4.5M20 9v4.5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-grid bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
