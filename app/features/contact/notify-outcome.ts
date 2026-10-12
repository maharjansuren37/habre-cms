// The pure half of the contact notification (item 19c): one email per
// recipient, and what came of them. Kept apart from the database and the mailer
// so a throwing sender can be tested without either. Never throws.

export type OutgoingEmail = { to: string; subject: string; text: string; replyTo?: string };

export async function deliverToAll(
  recipients: string[],
  mailFor: (to: string) => OutgoingEmail,
  sender: (message: OutgoingEmail) => Promise<void>,
): Promise<{ accepted: number; failed: number }> {
  const results = await Promise.allSettled(
    recipients.map(async (to) => {
      await sender(mailFor(to));
    }),
  );
  const accepted = results.filter((r) => r.status === "fulfilled").length;
  return { accepted, failed: results.length - accepted };
}
