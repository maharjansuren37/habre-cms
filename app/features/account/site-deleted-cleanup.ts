// What runs after a site's deletion has committed (item 15e2). The dependencies
// are parameters so a failing R2 or mail server can be tested without either.
// Nothing here ever rejects: the person already got what they asked for.

import { siteDeletedNotice } from "./site-deleted-notice.ts";

/** Removes each object; a failure is logged with its key (which names only the
 *  site's id) and the rest still go. */
export async function removeStorageObjects(
  keys: string[],
  remove: (key: string) => Promise<void>,
  log: (line: string, error: unknown) => void,
): Promise<void> {
  for (const key of keys) {
    try {
      await remove(key);
    } catch (error) {
      log(`Failed to delete R2 object ${key} of a deleted site:`, error);
    }
  }
}

/** Tells every member that the site was deleted. A failed send is reported to
 *  `onFailure` without the address and does not stop the others. */
export async function notifyMembers(
  members: { name: string; email: string }[],
  address: string,
  send: (message: { to: string; subject: string; text: string }) => Promise<void>,
  onFailure: () => void,
): Promise<void> {
  for (const member of members) {
    const { subject, text } = siteDeletedNotice(address, member.name);
    try {
      await send({ to: member.email, subject, text });
    } catch {
      onFailure();
    }
  }
}
