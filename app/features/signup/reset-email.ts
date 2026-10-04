// The email that carries the reset link (item 15c). Plain text only, as in
// verification-email.ts.

export const RESET_LIFETIME_HOURS = 1;

export function resetEmail(
  adminUrl: string,
  token: string,
  name?: string,
): { subject: string; text: string } {
  const link = `${adminUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  // First name only, and never a character a mail client could read as markup.
  const first = (name ?? "").replace(/[<>]/g, "").trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi,";
  return {
    subject: "Reset your Habre password",
    text: [
      greeting,
      "",
      "Open this link to choose a new password for Habre:",
      "",
      link,
      "",
      `The link works once and for ${RESET_LIFETIME_HOURS} hour.`,
      "",
      "If you didn't ask for this, ignore this email. Your password has not changed.",
      "",
    ].join("\n"),
  };
}
