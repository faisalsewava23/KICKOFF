import { cn } from "@/lib/utils";

export function Logotype({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-heading font-bold uppercase tracking-tight text-primary",
        className
      )}
    >
      KickOff
    </span>
  );
}
