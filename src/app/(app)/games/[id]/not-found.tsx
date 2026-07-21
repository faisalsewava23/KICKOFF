import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export default function GameNotFound() {
  return (
    <div className="flex flex-col items-center py-12">
      <EmptyState
        icon={SearchX}
        title="Game not found"
        description="It might have been cancelled, or the link's wrong."
      />
      <Link
        href="/games"
        className={cn(
          buttonVariants({ variant: "default" }),
          "h-14 px-8 text-base font-semibold active:scale-95 transition-all"
        )}
      >
        Back to games
      </Link>
    </div>
  );
}
