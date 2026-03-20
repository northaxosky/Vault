import PlaidLink from "@/components/PlaidLink";

export default function DashboardPage() {
  // Auth is handled by the layout — no need to check here.
  // The layout also handles the sidebar, bg-mesh, and accent hue.
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Link Your Bank Account
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your bank account to start tracking your finances.
        </p>
        <div className="mt-4">
          <PlaidLink />
        </div>
      </div>
    </div>
  );
}
