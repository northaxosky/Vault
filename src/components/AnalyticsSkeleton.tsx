"use client";

export default function AnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spending trends and insights over time
        </p>
      </div>

      {/* Filter bar skeleton */}
      <div className="glass rounded-xl p-4 mb-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-10 w-full animate-pulse rounded-md bg-accent/20" />
          <div className="h-10 w-full animate-pulse rounded-md bg-accent/20" />
          <div className="h-10 w-full animate-pulse rounded-md bg-accent/20" />
        </div>
      </div>

      {/* Key metrics skeleton */}
      <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="h-4 w-24 mb-2 animate-pulse rounded-md bg-accent/20" />
            <div className="h-8 w-32 animate-pulse rounded-md bg-accent/20" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Line chart */}
        <div className="glass rounded-xl p-6">
          <div className="h-6 w-48 mb-4 animate-pulse rounded-md bg-accent/20" />
          <div className="h-64 w-full animate-pulse rounded-md bg-accent/20" />
        </div>

        {/* Pie chart */}
        <div className="glass rounded-xl p-6">
          <div className="h-6 w-48 mb-4 animate-pulse rounded-md bg-accent/20" />
          <div className="h-64 w-full animate-pulse rounded-md bg-accent/20" />
        </div>

        {/* Bar chart */}
        <div className="glass rounded-xl p-6 lg:col-span-2">
          <div className="h-6 w-48 mb-4 animate-pulse rounded-md bg-accent/20" />
          <div className="h-64 w-full animate-pulse rounded-md bg-accent/20" />
        </div>

        {/* Top merchants */}
        <div className="glass rounded-xl p-6 lg:col-span-2">
          <div className="h-6 w-48 mb-4 animate-pulse rounded-md bg-accent/20" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-md bg-accent/20" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
