import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <SearchX className="size-16 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Nothing here
      </h1>
      <p className="text-muted-foreground">
        That page doesn&apos;t exist — but there&apos;s probably a game on.
      </p>
      <Link
        href="/games"
        className={cn(
          buttonVariants(),
          "mt-2 h-14 px-8 text-base font-semibold active:scale-95 transition-all"
        )}
      >
        Browse games
      </Link>
    </div>
  );
}
