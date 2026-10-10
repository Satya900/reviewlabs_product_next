import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const env = {
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  razorpayKeyId: () => required("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
  razorpayKeySecret: () => required("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: () => required("RAZORPAY_WEBHOOK_SECRET"),
  razorpayCreatorPlanId: () => required("RAZORPAY_CREATOR_PLAN_ID"),
  encryptionKey: () => required("ENCRYPTION_KEY"),
  cronSecret: () => required("CRON_SECRET"),
  resendApiKey: () => process.env.RESEND_API_KEY || null,
  emailFrom: () => process.env.EMAIL_FROM ?? "Reviewlabs <no-reply@reviewlabs.space>",
  metaGraphVersion: () => process.env.META_GRAPH_VERSION ?? "v24.0",
  // 0 or unset = lifetime access (links never expire).
  downloadTtlDays: (): number | null => {
    const days = Number(process.env.DOWNLOAD_LINK_TTL_DAYS ?? 0);
    return days > 0 ? days : null;
  },
  // Per-link cap against public link sharing; buyers can reset it by
  // requesting a fresh link with their email.
  downloadMaxPerGrant: () => Number(process.env.DOWNLOAD_MAX_PER_GRANT ?? 50),
};
