export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 animate-pulse">
      {/* Header */}
      <div className="h-7 w-28 rounded bg-muted" />
      <div className="mt-2 h-4 w-56 rounded bg-muted" />

      {/* Search */}
      <div className="mt-6 h-9 w-full rounded-md bg-muted" />

      {/* Two-panel layout */}
      <div className="mt-6 flex gap-6">
        {/* Nav */}
        <div className="hidden md:block w-56 shrink-0 space-y-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-8 w-full rounded-md bg-muted" />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="h-6 w-24 rounded bg-muted" />
            <div className="space-y-3">
              <div>
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="mt-1.5 h-9 w-full rounded-md bg-muted" />
              </div>
              <div>
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="mt-1.5 h-9 w-full rounded-md bg-muted" />
              </div>
            </div>
            <div className="h-9 w-28 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
