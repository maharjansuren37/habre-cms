import { createTransport } from "nodemailer";
import { env } from "#app/lib/env.server.ts";

// Plain text only (item 15b). Throws on failure and the caller decides what
// the person sees. Never logs the address or the text - they carry sign-in
// links and people's emails.
let transport: ReturnType<typeof createTransport> | undefined;

function getTransport() {
  if (!env.SMTP_URL) throw new Error("SMTP_URL is not set");
  transport ??= createTransport({
    url: env.SMTP_URL,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  return transport;
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  if (!env.EMAIL_FROM) throw new Error("EMAIL_FROM is not set");
  await getTransport().sendMail({ from: env.EMAIL_FROM, ...message });
}
