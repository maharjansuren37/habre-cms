import {
  contactNotificationEmail,
  notificationRecipients,
} from "#app/features/contact/notification-email.ts";
import { inSite } from "#app/lib/db.server.ts";
import { sendEmail } from "#app/lib/email.server.ts";
import { isEmailOn } from "#app/lib/email-env.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { deliverToAll, type OutgoingEmail } from "./notify-outcome.ts";

type Visitor = { name: string; email: string; message: string };

/**
 * Emails a saved contact message to the site's owner (item 19c). Started by the
 * submit action without awaiting it, so it never throws: any failure is logged
 * with the site id only. With no email configured nothing is attempted and
 * `notified_at` stays null. `sender` is a parameter so a test can fail it.
 */
export async function notifyContact(
  siteId: string,
  submission: { id: string; entryId: string } & Visitor,
  sender: (message: OutgoingEmail) => Promise<void> = sendEmail,
): Promise<void> {
  if (!isEmailOn(env)) return;
  try {
    const context = await inSite(siteId, async (tx) => {
      const [settings] = await tx<{ siteTitle: string; notify: string | null }[]>`
        select site_title as "siteTitle", contact_notify_email as notify
        from site_settings where site_id = ${siteId}
      `;
      const [page] = await tx<{ title: string }[]>`
        select title from entries where site_id = ${siteId} and id = ${submission.entryId}
      `;
      const admins = await tx<{ email: string }[]>`
        select u.email
        from site_members m join users u on u.id = m.user_id
        where m.site_id = ${siteId} and m.role = 'admin' and m.deactivated_at is null
          and u.email_verified_at is not null
      `;
      return { settings, page, admins: admins.map((a) => a.email) };
    });

    const recipients = notificationRecipients(context.settings?.notify ?? "", context.admins);
    const messagesUrl = `${env.PLATFORM_URL.replace(/\/+$/, "")}/admin/messages`;
    const { subject, text } = contactNotificationEmail({
      siteTitle: context.settings?.siteTitle ?? "",
      visitorName: submission.name,
      visitorEmail: submission.email,
      message: submission.message,
      pageTitle: context.page?.title ?? "",
      messagesUrl,
    });

    const { accepted, failed } = await deliverToAll(
      recipients,
      (to) => ({ to, subject, text, replyTo: submission.email }),
      sender,
    );
    if (failed > 0) logSecurityEvent({ event: "contact_notify_failed", siteId });
    if (accepted > 0) {
      await inSite(siteId, async (tx) => {
        await tx`
          update contact_submissions set notified_at = now()
          where site_id = ${siteId} and id = ${submission.id}
        `;
      });
    }
  } catch {
    logSecurityEvent({ event: "contact_notify_failed", siteId });
  }
}
