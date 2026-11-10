export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-56 rounded-2xl bg-panel sm:h-72" />
      <div className="h-6 w-48 rounded-full bg-panel-2" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[2/3] rounded-lg bg-panel-2" />
            <div className="h-3 w-3/4 rounded-full bg-panel-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
