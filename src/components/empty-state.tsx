import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title?: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 py-16 text-center",
        className
      )}
    >
      <Icon className="size-16 text-muted-foreground" aria-hidden />
      {title ? (
        <p className="font-heading text-3xl font-semibold tracking-tight">
          {title}
        </p>
      ) : null}
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
