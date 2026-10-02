# Needs you - done

## admin-data-host-redirect

- [x] **UptimeRobot account with an alert email** - account; free tier.
      `done`: `/healthz` checked every 5 minutes on both hostnames with a
      `"database":"up"` keyword check, plus SSL expiry alerts. Email delivery
      proven by a real alert. **This line was still marked open** despite
      `dev-notes/status.md` already recording it as done - found and closed
      by `docs`, 2026-09-23. (stack, 2026-09-15; closed by monitor, evidence
      reconciled by docs, 2026-09-23)
- [x] **Private R2 bucket for database backups, and a token scoped to it** -
      accounts. `done` 2026-09-16: the owner created the bucket and put the
      credentials in `/etc/habre-cms/backup.env` on the server (root-only, mode
      600, not the app's file). Checked by host, values never printed: listing
      that bucket -> 200, listing all buckets -> 403, unsigned read -> refused;
      its name differs from the images bucket. One backup ran and the object is
      in the bucket. (architect, 2026-09-15; closed by host)
- [x] **R2 images bucket and an API token scoped to it, for development** -
      accounts. `done` 2026-09-16 (owner added `R2_ACCOUNT_ID`,
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` to the local
      `.env`). Checked by host with signed requests, values never printed:
      listing the bucket -> 200; listing all buckets in the account -> 403, so
      the token is limited to that bucket. (architect, 2026-09-15; closed by host)

- [x] **On `ocwebserver`: install Node 26 and PostgreSQL 16, then create the
      `habre_cms` database plus a role owning only it** - system software/access.
      `done` 2026-09-16 by `deploy/setup-server.sh`, run with the owner's yes
      (the owner installed `rsync` first). Checked: `node --version` -> v26.8.2;
      PostgreSQL 16.15 listening on localhost only; role `habre_cms` (not
      superuser, no createrole/createdb) owns only database `habre_cms` and logs
      in with the generated password. (architect, 2026-09-15; closed by host)
- [x] **Off-server location for nightly database backups** - decision. `done`
      2026-09-16: a private R2 bucket (D21); creating it is the open line
      above. (architect, 2026-09-15; closed by host)

<!-- Move lines here rather than deleting them. What was needed and when it was
     settled is worth keeping - it is the honest answer to "why did this take
     three days", and it stops the same question being asked again. -->

- [x] **DNS record for `cms.surenmaharjan.fyi` pointing at the VPS** -
      access; your DNS. `done` 2026-09-16 (user reported; checked by
      resolving it): `cms.surenmaharjan.fyi` is a CNAME to `surenmaharjan.fyi`,
      A `161.33.89.75`, no AAAA. Because it is a CNAME, adding an AAAA to the root
      domain would also put the CMS on IPv6 (see F-13). (architect, 2026-09-15;
      closed by build)
- [x] **Install Node 26 on this dev machine** - system software. `done`
      2026-09-15: `node --version` -> v26.8.1; `npm run verify` and the
      Playwright tests passed on it. (stack; closed by scaffold)

## features/13-upgrade-react-router

- [x] **Screen-reader and keyboard pass over the block editor** (NVDA, VoiceOver
      or Orca) - manual verification; no automated check hears what Editor.js
      announces, and `design.md` names the editor's blocks and block menu as the
      hardest part of the accessibility bar. Covers the + toolbox, the block
      settings menu, and - from item 2b - the inline toolbar (Bold, Italic,
      Link) and its link field. Done during item 2a's or 2b's `verify`.
      **Risk accepted by the owner, 2026-09-23: shipping items 5-8 to
      production without this; will do the accessibility pass after the MVP
      is live.** Blocks nothing now; `preflight` needs it. `open` (spec,
      2026-09-16; risk accepted, preflight, 2026-09-23)
      `dropped` (owner, 2026-10-02): item 14a replaces Editor.js with TipTap
      (D165, D169) before v1's one deploy (D163), so this pass would check an
      editor on its way out - 14a's spec adds a pass over the new editor.

- [x] **Keyboard and screen-reader pass over the section controls** (NVDA,
      VoiceOver or Orca) - manual verification; no automated check hears the
      section cards, Move up / Move down, the inline remove confirmation or the
      "Section moved to position 2 of 4" announcements. Blocks nothing now;
      `preflight` needs it before item 10 is deployed. From item 11, the same
      pass covers the "Columns" radio group, the announcements when the count
      changes, and editors inside narrow columns. `open` (spec, item 10,
      2026-10-01; widened, item 11, 2026-10-01). From item 12a, the same pass covers the
      "Add blank section" / "Add hero section" buttons and the hero form's
      labels, hint, errors and focus (spec, item 12a, 2026-10-01). From item 12b, the same pass covers "Add call to action" and the call-to-action form, whose button fields are required (spec, item 12b, 2026-10-01). From item 12c, the same pass covers "Add image and text", the image slot's Choose/Change image button, the picker dialog's focus in and out, and the missing-image message (spec, item 12c, 2026-10-01)
      `dropped` (owner, 2026-10-02): items 14a-14c replace these section
      controls (D165, D170) before v1's one deploy (D163) - 14a's spec adds a
      pass over the new editor's controls.
