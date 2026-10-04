import { expect } from "@playwright/test";

// Mailpit's API (docker compose up -d): the development and CI mail catcher.
const MAILPIT = "http://127.0.0.1:8025/api/v1";

type Summary = { ID: string };

/** Ids of the messages sent to one address. Each test uses its own random
 *  address, so `workers: 2` cannot cross messages. */
export async function messagesTo(email: string): Promise<string[]> {
  const response = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  if (!response.ok) throw new Error(`Mailpit answered ${response.status}`);
  const body = (await response.json()) as { messages: Summary[] | null };
  return (body.messages ?? []).map((message) => message.ID);
}

/** Waits until exactly `count` messages are in for this address (sending is
 *  asynchronous to the test), then returns their text, newest first. */
export async function waitForMail(email: string, count = 1): Promise<string[]> {
  await expect
    .poll(async () => (await messagesTo(email)).length, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(count);
  // A short pause, so a message that should not exist has time to arrive.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const ids = await messagesTo(email);
  expect(ids).toHaveLength(count);
  return Promise.all(
    ids.map(async (id) => {
      const response = await fetch(`${MAILPIT}/message/${id}`);
      const message = (await response.json()) as { Text: string };
      return message.Text;
    }),
  );
}

/** The token in the first link of an email's text. `path` is the link's path:
 *  `/verify`, `/reset-password` or `/confirm-email`. */
export function tokenFromMail(
  text: string,
  path: "/verify" | "/reset-password" | "/confirm-email" = "/verify",
): string {
  const match = new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`).exec(text);
  if (!match) throw new Error(`no ${path} link in the email`);
  return match[1];
}
