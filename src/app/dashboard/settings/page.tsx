import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  // Auth is handled by the dashboard layout, but we need the session
  // to fetch user-specific data.
  const session = await auth();

  // Fetch settings (upsert to ensure defaults exist)
  const settings = await prisma.userSettings.upsert({
    where: { userId: session!.user.id },
    update: {},
    create: { userId: session!.user.id },
  });

  // Fetch linked accounts for the "Linked Accounts" section
  const linkedAccounts = await prisma.plaidItem.findMany({
    where: { userId: session!.user.id },
    select: {
      id: true,
      institutionName: true,
      createdAt: true,
      accounts: {
        select: {
          id: true,
          name: true,
          type: true,
          subtype: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch user creation date for the profile section
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { createdAt: true },
  });

  return (
    <SettingsClient
      userName={session!.user.name ?? null}
      userEmail={session!.user.email ?? ""}
      userCreatedAt={user!.createdAt.toISOString()}
      settings={{
        accentHue: settings.accentHue,
        currency: settings.currency,
        dateFormat: settings.dateFormat,
        emailAlerts: settings.emailAlerts,
        spendingAlert: settings.spendingAlert ? Number(settings.spendingAlert) : null,
        lowBalanceAlert: settings.lowBalanceAlert ? Number(settings.lowBalanceAlert) : null,
        weeklyDigest: settings.weeklyDigest,
      }}
      linkedAccounts={linkedAccounts.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      }))}
    />
  );
}
