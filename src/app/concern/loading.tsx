import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="container-page py-6 md:py-10">
      <SkeletonLine className="h-6 w-48" />
      <SkeletonLine className="mt-2 h-4 w-32" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <SkeletonBlock className="aspect-square" />
            <SkeletonLine className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
