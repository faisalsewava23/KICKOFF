"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logotype } from "@/components/logotype";
import { cn, formatPence, initials } from "@/lib/utils";
import { signOut } from "@/app/(app)/actions";

export function TopBar({
  loggedIn,
  displayName,
  isOrganiser,
  walletPence,
}: {
  loggedIn: boolean;
  displayName: string;
  isOrganiser: boolean;
  walletPence: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between px-5">
        <Link href="/games" className="active:scale-95 transition-all">
          <Logotype className="text-lg" />
        </Link>
        {!loggedIn ? (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 px-4 font-semibold active:scale-95 transition-all"
            )}
          >
            Log in
          </Link>
        ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 transition-all"
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-secondary text-xs font-semibold">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <div className="flex items-center justify-between px-2 py-1.5 text-sm">
              <span className="text-muted-foreground">Wallet</span>
              <span className="font-semibold tabular-nums">
                {formatPence(walletPence)}
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/bookings")}>
              My bookings
            </DropdownMenuItem>
            {isOrganiser ? (
              <DropdownMenuItem onClick={() => router.push("/organiser")}>
                Organiser dashboard
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => router.push("/organiser/onboarding")}
              >
                Become an organiser
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => startTransition(() => signOut())}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
    </header>
  );
}
