export default function GoalsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 animate-pulse">
      <div className="h-7 w-32 rounded bg-muted" />
      <div className="mt-2 h-4 w-56 rounded bg-muted" />

      <div className="mt-6 flex gap-2">
        <div className="h-8 w-28 rounded-lg bg-muted" />
        <div className="h-8 w-28 rounded-lg bg-muted" />
        <div className="h-8 w-32 rounded-lg bg-muted" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-2 h-7 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
