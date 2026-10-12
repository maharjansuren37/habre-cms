import { data, Form, Link, redirect } from "react-router";
import { z } from "zod";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { isEmailOn } from "#app/lib/email-env.server.ts";
import { env } from "#app/lib/env.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/messages";
import styles from "./messages.module.css";
import { listMessages, setMessageRead } from "./messages.server.ts";
import { parseMessagesPage } from "./messages-query.ts";

// Admin only; the nav hides the link too, and anyone else gets the 404 an
// ownership refusal already gives (require-role.server.ts, D69).
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin"])];

// A send still in flight is not reported as failed.
const FAILED_AFTER_MS = 2 * 60 * 1000;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Messages - Habre CMS" }];
}

/** Only the params that differ from the default, as media-list.tsx's `mediaListHref`. */
function messagesHref(page: number): string {
  return page > 1 ? `/admin/messages?page=${page}` : "/admin/messages";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = context.get(userContext);
  const page = parseMessagesPage(new URL(request.url));
  const list = await listMessages(actor.siteId, page);
  // A stale page past the real end would show a false empty state.
  if (page > list.totalPages && list.total > 0) {
    throw redirect(messagesHref(list.totalPages));
  }
  const emailOn = isEmailOn(env);
  const cutoff = Date.now() - FAILED_AFTER_MS;
  return {
    messages: list.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      isUnread: row.readAt === null,
      entryTitle: row.entryTitle,
      emailFailed: emailOn && row.notifiedAt === null && row.createdAt.getTime() < cutoff,
    })),
    emailOn,
    total: list.total,
    totalPages: list.totalPages,
    page,
  };
}

const markInput = z.object({
  id: z.uuid(),
  intent: z.enum(["read", "unread"]),
});

export async function action({ request, context }: Route.ActionArgs) {
  const actor = context.get(userContext);
  const form = await request.formData();
  const parsed = markInput.safeParse({ id: form.get("id"), intent: form.get("intent") });
  if (!parsed.success) throw data("Bad Request", { status: 400 });
  // A stale id matches no row: nothing changes and the redirect is the answer.
  await setMessageRead(actor.siteId, parsed.data.id, parsed.data.intent === "read");
  const page = parseMessagesPage(new URL(request.url));
  return redirect(messagesHref(page));
}

const SENT_AT = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function Messages({ loaderData }: Route.ComponentProps) {
  const { messages, emailOn, total, totalPages, page } = loaderData;
  // Posted back to the page it was on, so marking on page 2 stays on page 2.
  const action = messagesHref(page);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Messages</h1>
      </div>
      {!emailOn && (
        <Message
          tone="notice"
          title="This installation can't send email, so messages are only kept here."
          className={styles.notice}
        />
      )}
      {messages.length === 0 ? (
        <>
          <p className={styles.empty}>No messages yet.</p>
          <p className={styles.empty}>
            Add a contact form to a page from the editor's palette, and what visitors send appears
            here.
          </p>
        </>
      ) : (
        <ol className={styles.list}>
          {messages.map((item) => (
            <li key={item.id}>
              <article className={styles.card}>
                <div className={styles.top}>
                  <span className={styles.name}>{item.name}</span>
                  <a href={`mailto:${encodeURIComponent(item.email).replace(/%40/g, "@")}`}>
                    {item.email}
                  </a>
                  {item.isUnread && (
                    <span className={[styles.badge, styles.unread].join(" ")}>Unread</span>
                  )}
                </div>
                <p className={styles.meta}>
                  <time dateTime={item.createdAt}>
                    {SENT_AT.format(new Date(item.createdAt))} UTC
                  </time>
                  {" · "}
                  {item.entryTitle === null
                    ? "Sent from a page that has been deleted"
                    : `Sent from ${item.entryTitle}`}
                </p>
                <p className={styles.text}>{item.message}</p>
                {item.emailFailed && (
                  <p className={styles.failed}>We couldn't email this message to you.</p>
                )}
                <Form method="post" action={action} className={styles.actions}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="intent" value={item.isUnread ? "read" : "unread"} />
                  <Button type="submit">
                    {item.isUnread ? "Mark as read" : "Mark as unread"}
                    <span className="visually-hidden"> from {item.name}</span>
                  </Button>
                </Form>
              </article>
            </li>
          ))}
        </ol>
      )}
      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Messages pages">
          {page > 1 && <Link to={messagesHref(page - 1)}>Previous</Link>}
          <span className={styles.pageStatus}>
            Page {page} of {totalPages} ({total} messages)
          </span>
          {page < totalPages && <Link to={messagesHref(page + 1)}>Next</Link>}
        </nav>
      )}
    </>
  );
}
