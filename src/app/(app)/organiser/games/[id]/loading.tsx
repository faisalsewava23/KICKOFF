import { Skeleton } from "@/components/ui/skeleton";

export default function OrganiserGameLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-12 w-36" />
        <Skeleton className="mt-3 h-4 w-56" />
      </div>
      <div className="rounded-xl border bg-card p-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-1 w-full rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-28" />
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
