export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 rounded bg-muted" />
          <div className="mt-2 h-4 w-48 rounded bg-muted" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-20 rounded-lg bg-muted" />
          <div className="h-9 w-32 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="h-7 w-28 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="mt-6 glass rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 rounded-lg bg-muted" />
          <div className="flex gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 w-9 rounded-md bg-muted" />
            ))}
          </div>
        </div>
        <div className="mt-4 h-[280px] rounded bg-muted" />
      </div>

      {/* Recent Transactions + Spending Chart */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass rounded-xl p-6">
          <div className="h-6 w-44 rounded bg-muted" />
          <div className="mt-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
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
        <div className="glass rounded-xl p-6">
          <div className="h-6 w-44 rounded bg-muted" />
          <div className="mt-4 flex items-center justify-center">
            <div className="h-40 w-40 rounded-full bg-muted" />
          </div>
        </div>
      </div>

      {/* Linked Accounts */}
      <div className="mt-8">
        <div className="h-6 w-36 rounded bg-muted" />
        <div className="mt-4 space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-6">
              <div className="h-5 w-40 rounded bg-muted" />
              <div className="my-4 border-t border-border" />
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="h-4 w-36 rounded bg-muted" />
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
    </div>
  );
}
