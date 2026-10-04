// The notice sent to every other member after a site is deleted with its last
// admin's account (item 15e2). Plain text only, as in email-changed-notice.ts.

export function siteDeletedNotice(
  address: string,
  name?: string,
): { subject: string; text: string } {
  // Never a character a mail client could read as markup: first name only, and
  // the address (a subdomain, so none in practice) gets the same treatment.
  const strip = (value: string) => value.replace(/[<>]/g, "").trim();
  const first = strip(name ?? "").split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi,";
  return {
    subject: "Your Habre site was deleted",
    text: [
      greeting,
      "",
      `Your site ${strip(address)} was deleted by its admin. Your account was deleted with it, so you can no longer sign in.`,
      "",
      "If you didn't expect this, reply to this email and we'll help.",
      "",
    ].join("\n"),
  };
}
