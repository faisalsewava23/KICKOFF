import { Skeleton } from "@/components/ui/skeleton";

export default function OrganiserLoading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div>
        <Skeleton className="h-3 w-28" />
        <div className="mt-2 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="mt-2 h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-3 w-32" />
        <div className="mt-2 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-2 h-7 w-52" />
              <Skeleton className="mt-3 h-1 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
