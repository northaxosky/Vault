export default function InvestmentsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 animate-pulse">
      {/* Header */}
      <div className="h-7 w-40 rounded bg-muted" />
      <div className="mt-2 h-4 w-56 rounded bg-muted" />

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-7 w-28 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Holdings by account */}
      <div className="mt-8 space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-5 w-44 rounded bg-muted" />
                  <div className="h-3 w-28 rounded bg-muted" />
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <div className="h-5 w-24 rounded bg-muted ml-auto" />
                <div className="h-3 w-16 rounded bg-muted ml-auto" />
              </div>
            </div>
            <div className="my-4 border-t border-border" />
            <div className="space-y-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 rounded bg-muted" />
                    <div className="h-3 w-24 rounded bg-muted" />
                  </div>
                  <div className="space-y-1.5 text-right">
                    <div className="h-4 w-20 rounded bg-muted ml-auto" />
                    <div className="h-3 w-14 rounded bg-muted ml-auto" />
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
