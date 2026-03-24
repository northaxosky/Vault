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
