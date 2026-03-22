export default function InsightsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 animate-pulse">
      <div className="h-7 w-40 rounded bg-muted" />
      <div className="mt-2 h-4 w-64 rounded bg-muted" />

      <div className="mt-6 flex gap-2">
        <div className="h-8 w-32 rounded-lg bg-muted" />
        <div className="h-8 w-36 rounded-lg bg-muted" />
        <div className="h-8 w-32 rounded-lg bg-muted" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-2 h-7 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="mt-6 glass rounded-xl p-6">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="mt-4 h-48 rounded bg-muted" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass rounded-xl p-6">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="mt-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-xl p-6">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="mt-4 h-40 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
