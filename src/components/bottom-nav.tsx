"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, Ticket, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({
  loggedIn,
  isOrganiser,
}: {
  loggedIn: boolean;
  isOrganiser: boolean;
}) {
  const pathname = usePathname();

  // Game detail pages have their own sticky CTA bar (Airbnb pattern) —
  // hide the nav there so the two bars never stack.
  if (/^\/games\/.+/.test(pathname)) return null;

  const tabs = [
    { href: "/games", label: "Games", icon: Trophy, target: "/games" },
    {
      href: "/bookings",
      label: "Bookings",
      icon: Ticket,
      target: loggedIn
        ? "/bookings"
        : `/login?next=${encodeURIComponent("/bookings")}`,
    },
    ...(isOrganiser
      ? [
          {
            href: "/organiser",
            label: "Organise",
            icon: CalendarPlus,
            target: "/organiser",
          },
        ]
      : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon, target }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={target}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium active:scale-95 transition-all",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
