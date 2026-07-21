import { Skeleton } from "@/components/ui/skeleton";

export default function BookingsLoading() {
  return (
    <section>
      <Skeleton className="h-4 w-28" />
      <div className="mt-4 flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        ))}
      </div>
    </section>
  );
}
