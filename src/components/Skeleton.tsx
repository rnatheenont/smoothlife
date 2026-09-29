/**
 * The shape of what is coming, while it comes.
 *
 * A blank screen and a slow screen look identical for the first second, and
 * on a phone that second is the whole of somebody's patience. These are the
 * page's own bones — same rounding, same rhythm — so the real content lands
 * in the places the eye has already accepted.
 */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-surface-soft ${className}`} />;
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl2 bg-surface-soft ${className}`} />;
}

/** A row of product cards, the shape used on nearly every page of the shop. */
export function SkeletonProductRail({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-4 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[45vw] shrink-0 md:w-auto">
          <SkeletonBlock className="aspect-square" />
          <SkeletonLine className="mt-2 h-3 w-3/4" />
          <SkeletonLine className="mt-1.5 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
