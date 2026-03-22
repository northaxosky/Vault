export default function TransactionsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 animate-pulse">
      {/* Header */}
      <div className="h-7 w-40 rounded bg-muted" />
      <div className="mt-2 h-4 w-56 rounded bg-muted" />

      {/* Filter bar */}
      <div className="mt-6 glass rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="h-9 flex-1 rounded-md bg-muted" />
          <div className="h-9 w-full sm:w-48 rounded-md bg-muted" />
        </div>
      </div>

      {/* Results count */}
      <div className="mt-4 h-4 w-32 rounded bg-muted" />

      {/* Transaction groups */}
      <div className="mt-4 space-y-6">
        {[...Array(3)].map((_, g) => (
          <div key={g}>
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="mt-2 glass rounded-xl divide-y divide-border">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 rounded bg-muted" />
                      <div className="h-3 w-20 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
