import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";

export default function AccountLoading() {
  return (
    <div className="container-page py-6 md:py-10">
      <SkeletonLine className="h-6 w-40" />
      <SkeletonBlock className="mt-4 h-28 w-full" />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <SkeletonBlock className="mt-4 h-64 w-full" />
    </div>
  );
}
