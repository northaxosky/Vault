import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "@/components/settings/SettingsClient";
import { isDemoMode } from "@/lib/demo";
import { DEMO_USER, DEMO_SETTINGS, DEMO_INSTITUTIONS } from "@/lib/demo-data";

export default async function SettingsPage() {
  if (isDemoMode()) {
    return (
      <SettingsClient
        userName={DEMO_USER.name}
        userEmail={DEMO_USER.email}
        userCreatedAt={DEMO_SETTINGS.createdAt}
        settings={{
          accentHue: DEMO_SETTINGS.accentHue,
          currency: DEMO_SETTINGS.currency,
          dateFormat: DEMO_SETTINGS.dateFormat,
          emailAlerts: DEMO_SETTINGS.emailAlerts,
          spendingAlert: DEMO_SETTINGS.spendingAlert,
          lowBalanceAlert: DEMO_SETTINGS.lowBalanceAlert,
          weeklyDigest: DEMO_SETTINGS.weeklyDigest,
        }}
        linkedAccounts={DEMO_INSTITUTIONS.map((inst) => ({
          id: inst.id,
          institutionName: inst.institutionName,
          createdAt: inst.createdAt,
          accounts: inst.accounts.map((acc) => ({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
          })),
        }))}
      />
    );
  }

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
