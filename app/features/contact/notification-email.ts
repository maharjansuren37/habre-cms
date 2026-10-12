// The email that tells a site's owner someone used the contact form (item
// 19c). Plain text only, like the signup emails. The visitor's words are put
// in verbatim in the body and never in a header position: the subject carries
// only the name and site title, collapsed to one line.

const SUBJECT_MAX = 120;

function oneLine(value: string): string {
  // Whitespace and C0/C1 control characters, newlines included.
  return value.replace(/[\s\p{Cc}]+/gu, " ").trim();
}

export function contactNotificationEmail(input: {
  siteTitle: string;
  visitorName: string;
  visitorEmail: string;
  message: string;
  pageTitle: string;
  messagesUrl: string;
}): { subject: string; text: string } {
  const subject =
    `New message from ${oneLine(input.visitorName)} on ${oneLine(input.siteTitle)}`.slice(
      0,
      SUBJECT_MAX,
    );
  const text = [
    `From: ${input.visitorName}`,
    `Their email: ${input.visitorEmail}`,
    `Page: ${input.pageTitle}`,
    "",
    input.message,
    "",
    `All your messages: ${input.messagesUrl}`,
    "",
    "Reply to this email to answer them.",
    "",
  ].join("\n");
  return { subject, text };
}

// The one address set in Settings, or else every admin's, de-duplicated.
export function notificationRecipients(setting: string, admins: string[]): string[] {
  const set = setting.trim();
  if (set) return [set];
  return [...new Set(admins.map((a) => a.trim().toLowerCase()).filter(Boolean))];
}
