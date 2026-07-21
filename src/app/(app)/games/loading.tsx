import { Skeleton } from "@/components/ui/skeleton";

export default function GamesLoading() {
  return (
    <section>
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 flex flex-col gap-6">
        {[0, 1].map((group) => (
          <div key={group}>
            <Skeleton className="h-3 w-20" />
            <div className="mt-2 flex flex-col gap-3">
              {[0, 1].map((card) => (
                <Skeleton key={card} className="h-[104px] rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
