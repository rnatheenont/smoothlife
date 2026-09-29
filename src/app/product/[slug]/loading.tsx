import { SkeletonBlock, SkeletonLine, SkeletonProductRail } from "@/components/Skeleton";

export default function ProductLoading() {
  return (
    <div className="container-page py-6 md:py-10">
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <SkeletonBlock className="aspect-square w-full" />
        <div className="flex flex-col gap-3">
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="h-6 w-4/5" />
          <SkeletonLine className="h-6 w-1/3" />
          <SkeletonLine className="mt-2 h-11 w-full rounded-full" />
          <SkeletonLine className="h-11 w-full rounded-full" />
        </div>
      </div>
      <div className="mt-10">
        <SkeletonLine className="mb-4 h-5 w-40" />
        <SkeletonProductRail />
      </div>
    </div>
  );
}
