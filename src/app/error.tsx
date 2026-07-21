"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <CircleAlert className="size-16 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        Not a red card, just a stumble. Give it another go.
      </p>
      <Button
        onClick={reset}
        className="mt-2 h-14 px-8 text-base font-semibold active:scale-95 transition-all"
      >
        Try again
      </Button>
    </div>
  );
}
