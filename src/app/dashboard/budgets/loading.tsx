export default function BudgetsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 rounded bg-muted" />
          <div className="mt-2 h-4 w-56 rounded bg-muted" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>

      {/* Summary card */}
      <div className="mt-6 glass rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="mt-2 h-7 w-48 rounded bg-muted" />
          </div>
          <div className="text-right">
            <div className="h-4 w-20 rounded bg-muted ml-auto" />
            <div className="mt-2 h-7 w-28 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-4 h-2 w-full rounded bg-muted" />
      </div>

      {/* Budget cards */}
      <div className="mt-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-32 rounded bg-muted" />
                  <div className="h-5 w-10 rounded bg-muted" />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-4 w-8 rounded bg-muted" />
                </div>
                <div className="mt-2 h-1.5 w-full rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
