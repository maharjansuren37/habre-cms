// The notice sent to the OLD address after an email change is confirmed (item
// 15e1). Plain text only, as in email-change-email.ts. It never names the new
// address: the old inbox may be the one someone else is reading.

export function emailChangedNotice(name?: string): { subject: string; text: string } {
  // First name only, and never a character a mail client could read as markup.
  const first = (name ?? "").replace(/[<>]/g, "").trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi,";
  return {
    subject: "Your Habre email was changed",
    text: [
      greeting,
      "",
      "The email address for your Habre account was just changed. This address will no longer get emails about it.",
      "",
      "If you made this change, there's nothing to do.",
      "",
      "If you didn't, someone may have your password. Reply to this email and we'll help you get your account back.",
      "",
    ].join("\n"),
  };
}
