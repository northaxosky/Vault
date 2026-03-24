import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM ?? "Vault <onboarding@resend.dev>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Verify your email — Vault",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome to Vault</h2>
        <p>Click the button below to verify your email address.</p>
        <a href="${verifyUrl}"
           style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Verify Email
        </a>
        <p style="margin-top: 16px; font-size: 13px; color: #666;">
          This link expires in 24 hours. If you didn't create an account, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Verification email failed:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Reset your password — Vault",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the button below to choose a new password.</p>
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Reset Password
        </a>
        <p style="margin-top: 16px; font-size: 13px; color: #666;">
          This link expires in 1 hour. If you didn't request a reset, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Password reset email failed:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function sendEmailChangeVerification(email: string, token: string) {
  const confirmUrl = `${APP_URL}/api/user/email/confirm?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Confirm your new email — Vault",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Email Change Request</h2>
        <p>Click the button below to confirm this as your new email address for Vault.</p>
        <a href="${confirmUrl}"
           style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Confirm New Email
        </a>
        <p style="margin-top: 16px; font-size: 13px; color: #666;">
          This link expires in 1 hour. If you didn't request this change, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Email change verification failed:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function sendAlertEmail(
  email: string,
  alert: { type: string; title: string; message: string }
) {
  const iconMap: Record<string, string> = {
    LARGE_TRANSACTION: "💳",
    LOW_BALANCE: "⚠️",
    BUDGET_OVERSPEND: "📊",
  };
  const icon = iconMap[alert.type] || "🔔";

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `${icon} ${alert.title} — Vault`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${icon} ${alert.title}</h2>
        <p style="font-size: 16px;">${alert.message}</p>
        <a href="${APP_URL}/dashboard"
           style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          View Dashboard
        </a>
        <p style="margin-top: 16px; font-size: 13px; color: #666;">
          You're receiving this because email alerts are enabled in your Vault settings.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Alert email failed:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function sendWeeklyDigest(
  email: string,
  digest: import("@/types/digest").WeeklyDigestData
) {
  const start = new Date(digest.periodStart).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(digest.periodEnd).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const greeting = digest.userName ? `Hi ${digest.userName},` : "Hi,";
  const changeArrow = digest.spendingChange > 0 ? "↑" : "↓";
  const changeColor = digest.spendingChange > 0 ? "#ef4444" : "#22c55e";
  const changeText =
    digest.spendingChange !== 0
      ? `<span style="color: ${changeColor}; font-weight: 600;">${changeArrow} ${Math.abs(digest.spendingChange)}%</span> vs last week`
      : "Same as last week";

  const categoriesRows = digest.topCategories
    .map(
      (c) => `
        <tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${c.category.replace(/_/g, " ")}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${c.total.toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const recurringItems = digest.upcomingRecurring
    .map(
      (r) =>
        `<li style="padding: 4px 0;">${r.name} — <strong>$${r.amount.toFixed(2)}</strong> on ${new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</li>`
    )
    .join("");

  const budgetRows = digest.budgetStatus
    .map((b) => {
      const barColor = b.percentage >= 90 ? "#ef4444" : b.percentage >= 70 ? "#f59e0b" : "#22c55e";
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${b.category.replace(/_/g, " ")}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
            <div style="background: #e5e7eb; border-radius: 4px; height: 8px; width: 120px;">
              <div style="background: ${barColor}; border-radius: 4px; height: 8px; width: ${Math.min(b.percentage, 100)}%;"></div>
            </div>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">$${b.spent.toFixed(2)} / $${b.limit.toFixed(2)} (${b.percentage}%)</td>
        </tr>`;
    })
    .join("");

  const accountRows = digest.accountSummary
    .map(
      (a) => `
        <tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${a.name}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; color: #888; font-size: 13px;">${a.type}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${a.balance.toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin-bottom: 4px;">📊 Weekly Financial Digest</h2>
      <p style="color: #666; font-size: 13px; margin-top: 0;">${start} — ${end}</p>

      <p>${greeting}</p>
      <p>Here's your financial summary for the past week.</p>

      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 16px 0; text-align: center;">
        <p style="margin: 0; color: #666; font-size: 13px;">Total Spending</p>
        <p style="margin: 4px 0; font-size: 28px; font-weight: 700;">$${digest.totalSpending.toFixed(2)}</p>
        <p style="margin: 0; font-size: 13px;">${changeText}</p>
      </div>

      ${
        digest.topCategories.length > 0
          ? `<h3>Top Spending Categories</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${categoriesRows}
        </table>`
          : ""
      }

      ${
        digest.upcomingRecurring.length > 0
          ? `<h3>Upcoming Recurring Charges</h3>
        <ul style="padding-left: 20px; font-size: 14px;">${recurringItems}</ul>`
          : ""
      }

      ${
        digest.budgetStatus.length > 0
          ? `<h3>Budget Status</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${budgetRows}
        </table>`
          : ""
      }

      ${
        digest.accountSummary.length > 0
          ? `<h3>Account Balances</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${accountRows}
        </table>`
          : ""
      }

      ${
        digest.alertCount > 0
          ? `<p style="margin-top: 16px; font-size: 14px;">🔔 You had <strong>${digest.alertCount}</strong> alert${digest.alertCount === 1 ? "" : "s"} this week.</p>`
          : ""
      }

      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/dashboard"
           style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          View Dashboard
        </a>
      </div>

      <p style="margin-top: 24px; font-size: 12px; color: #999; text-align: center;">
        You're receiving this because Weekly Digest is enabled in your Vault settings.
      </p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `📊 Your Weekly Digest (${start} – ${end}) — Vault`,
    html,
  });

  if (error) {
    console.error("[email] Weekly digest email failed:", error);
    throw new Error(error.message);
  }

  return data;
}
