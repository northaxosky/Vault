export default function AccountsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 animate-pulse">
      {/* Header */}
      <div className="h-7 w-32 rounded bg-muted" />
      <div className="mt-2 h-4 w-56 rounded bg-muted" />

      {/* Summary + filter bar */}
      <div className="mt-6 glass rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>

      {/* Institution cards */}
      <div className="mt-6 space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded bg-muted" />
                <div className="h-5 w-40 rounded bg-muted" />
              </div>
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
            <div className="my-4 border-t border-border" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-36 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-16 rounded-full bg-muted" />
                    <div className="h-4 w-24 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
