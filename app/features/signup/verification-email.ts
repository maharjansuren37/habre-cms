// The email that carries the verify link (item 15b). Plain text only: no HTML
// to escape or test across mail clients (spec, Decisions).

export const VERIFY_LIFETIME_HOURS = 24;

export function verificationEmail(
  platformUrl: string,
  token: string,
  name?: string,
): { subject: string; text: string } {
  const link = `${platformUrl.replace(/\/+$/, "")}/verify?token=${encodeURIComponent(token)}`;
  // First name only, and never a character a mail client could read as markup.
  const first = (name ?? "").replace(/[<>]/g, "").trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi,";
  return {
    subject: "Confirm your email for Habre",
    text: [
      greeting,
      "",
      "Open this link to confirm your email and finish creating your website:",
      "",
      link,
      "",
      `The link works once and for ${VERIFY_LIFETIME_HOURS} hours. If you didn't sign up for Habre, you can ignore this email.`,
      "",
    ].join("\n"),
  };
}
