// The email that carries the new-address confirmation link (item 15e1). Plain
// text only, as in reset-email.ts.

export const EMAIL_CHANGE_LIFETIME_HOURS = 24;

export function emailChangeEmail(
  adminUrl: string,
  token: string,
  name?: string,
): { subject: string; text: string } {
  const link = `${adminUrl.replace(/\/+$/, "")}/confirm-email?token=${encodeURIComponent(token)}`;
  // First name only, and never a character a mail client could read as markup.
  const first = (name ?? "").replace(/[<>]/g, "").trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi,";
  return {
    subject: "Confirm your new Habre email",
    text: [
      greeting,
      "",
      "Open this link to make this address the email for your Habre account:",
      "",
      link,
      "",
      `The link works once and for ${EMAIL_CHANGE_LIFETIME_HOURS} hours.`,
      "",
      "If you didn't ask for this, ignore this email. Nothing changes until the link is used.",
      "",
    ].join("\n"),
  };
}
