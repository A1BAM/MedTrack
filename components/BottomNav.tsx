"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Log",
    icon: <path d="M12 5.5v13M5.5 12h13" strokeLinecap="round" />,
  },
  {
    href: "/peak",
    label: "Peak",
    icon: (
      <path
        d="M3.5 18.5h17L13.2 6.4a1.5 1.5 0 0 0-2.4 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.4" />
        <path d="M12 7.6V12l3 1.9" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: "/meals",
    label: "Meals",
    icon: (
      <>
        <path d="M7 3v18M4.2 3v4.6a2.8 2.8 0 0 0 5.6 0V3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.8 21V3.4c1.9 1.3 3 3.6 3 6.2 0 2.5-1.1 4.4-3 5.1" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: "/trends",
    label: "Trends",
    icon: (
      <path d="M4 16.5l5-5 3.3 3.3L20 7.5m0 0h-4.3M20 7.5v4.3" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-grid bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-5">
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
              className={`flex h-[74px] flex-col items-center justify-center gap-1.5 text-[10.5px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span
                className={`flex h-[30px] w-[54px] items-center justify-center rounded-full transition ${
                  active ? "bg-wash" : ""
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-[23px] w-[23px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden
                >
                  {tab.icon}
                </svg>
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
