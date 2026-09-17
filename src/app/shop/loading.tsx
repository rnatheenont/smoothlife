export default function ShopLoading() {
  return (
    <div className="container-page py-8 md:py-10">
      <div className="mb-6">
        <div className="h-8 w-40 rounded-lg bg-surface-soft animate-pulse" />
        <div className="h-4 w-24 rounded-sm bg-surface-soft animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl2 border border-slate-100 overflow-hidden">
            <div className="aspect-square bg-surface-soft animate-pulse" />
            <div className="p-3 flex flex-col gap-2">
              <div className="h-3 w-3/4 rounded-sm bg-surface-soft animate-pulse" />
              <div className="h-3 w-1/2 rounded-sm bg-surface-soft animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
