import { useEffect, useRef, useState } from "react";
import { data, Form, redirect, useNavigation, useRouteLoaderData } from "react-router";
import type { loader as adminLayoutLoader } from "#app/features/admin-shell/layout.tsx";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { listPagesForNav } from "#app/features/content/entries.server.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/settings";
import { openLogoPickerDialog, type PickedLogo } from "./logo-picker.client.ts";
import {
  applyNavIntent,
  draftRowsToNavItems,
  type NavDraftRow,
  navItemsToDraftRows,
  parseDraftRows,
} from "./navigation-form-input.ts";
import { NAV_MAX_ITEMS } from "./navigation-input.ts";
import styles from "./settings.module.css";
import { updateNavigation, updateSiteIdentity } from "./settings.server.ts";
import { logoMediaIdSchema, siteTitleSchema } from "./settings-input.ts";

// Admin only (project-plan.md's routes table) - an editor or author gets the
// same 404 an ownership refusal already gives (require-role.server.ts), and
// the nav hides the link too (admin-shell/layout.tsx).
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin"])];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Settings - Habre CMS" }];
}

// No settings fetch here - the admin-shell layout's own loader already reads
// the same row for the sidebar, on every admin page including this one
// (F-91); reading it back via useRouteLoaderData below avoids a second query.
export async function loader({ request }: Route.LoaderArgs) {
  const updated = new URL(request.url).searchParams.get("updated") !== null;
  const pages = await listPagesForNav();
  return { updated, pages };
}

/** What every non-redirect action response carries, whether it reshaped the
 *  draft or refused a save - one shape, so the component never has to check
 *  which kind of response it got before reading it. */
type ActionResult = { problem: string | null; draftRows: NavDraftRow[]; siteTitle: string };

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");
  const submittedTitle = String(form.get("siteTitle") ?? "");
  const rows = parseDraftRows(form);

  // Add/remove/move only rearrange what is already on the page - no
  // database write, so nothing below this needs validating yet.
  const reshaped = applyNavIntent(intent, rows);
  if (reshaped) {
    return { problem: null, draftRows: reshaped, siteTitle: submittedTitle } satisfies ActionResult;
  }

  const title = siteTitleSchema.safeParse(submittedTitle);
  if (!title.success) {
    return data(
      {
        problem: title.error.issues[0]?.message ?? "Enter a site title.",
        draftRows: rows,
        siteTitle: submittedTitle,
      } satisfies ActionResult,
      { status: 400 },
    );
  }
  const rawLogoId = form.get("logoMediaId");
  const logoId = logoMediaIdSchema.safeParse(rawLogoId === "" ? null : rawLogoId);
  // A well-formed id can still be gone - deleted from the library between the
  // picker's own fetch and this save, or a crafted request. The column has a
  // real foreign key (unlike a block's JSON image reference), so an unchecked
  // id would otherwise reach the database as an unhandled 23503 (F-89).
  if (!logoId.success || (logoId.data && (await findMediaByIds([logoId.data])).length === 0)) {
    return data(
      {
        problem: "That logo could not be saved. Choose it again.",
        draftRows: rows,
        siteTitle: submittedTitle,
      } satisfies ActionResult,
      { status: 400 },
    );
  }

  const pages = await listPagesForNav();
  const navResult = draftRowsToNavItems(rows, new Set(pages.map((page) => page.id)));
  if (!navResult.ok) {
    return data(
      {
        problem: navResult.message,
        draftRows: rows,
        siteTitle: submittedTitle,
      } satisfies ActionResult,
      { status: 400 },
    );
  }

  await updateSiteIdentity({ siteTitle: title.data, logoMediaId: logoId.data });
  await updateNavigation(navResult.items);
  return redirect("/admin/settings?updated=1");
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { updated, pages } = loaderData;
  // The fallback is practically unreachable - this route only ever renders
  // nested inside the layout that provides it (app/routes.ts) - but avoids a
  // non-null assertion for a value the type system cannot itself guarantee.
  const settings = useRouteLoaderData<typeof adminLayoutLoader>("features/admin-shell/layout")
    ?.settings ?? { siteTitle: "Habre CMS", logoMediaId: null, logoUrl: null, navigation: [] };
  const [logo, setLogo] = useState<PickedLogo | null>(
    settings.logoMediaId && settings.logoUrl
      ? { id: settings.logoMediaId, url: settings.logoUrl, filename: "" }
      : null,
  );
  const navigation = useNavigation();
  const submittedIntent = String(navigation.formData?.get("intent") ?? "save");
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formAction === "/admin/settings" &&
    submittedIntent === "save";

  // Every add/remove/move/save round trip reads the rows as they were just
  // submitted (actionData), so an edit typed into one row survives a button
  // pressed on another; only the very first render falls back to what is
  // actually saved.
  const draftRows = actionData ? actionData.draftRows : navItemsToDraftRows(settings.navigation);
  const siteTitleDefault = actionData ? actionData.siteTitle : settings.siteTitle;
  const pageById = new Map(pages.map((page) => [page.id, page]));

  // The picker's dialog closes before it hands back a pick (logo-picker.client.ts),
  // which restores focus to whatever opened it - but that element is the exact
  // one this re-render is about to remove (placeholder <-> preview swap the
  // button's own root element), so the browser's restored focus lands on a node
  // that is gone by the time it paints. image-tool.client.ts hits the identical
  // mechanism and fixes it the same way (F-76): re-focus a button by hand once
  // the new content exists. Skipped on mount so loading an already-set logo
  // does not steal focus from nothing.
  const logoFieldRef = useRef<HTMLFieldSetElement>(null);
  const hasMountedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: depends on `logo` to re-run on every change, though the body only reads refs
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    logoFieldRef.current?.querySelector("button")?.focus();
  }, [logo]);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>
      {updated && <Message tone="success" title="Settings updated." className={styles.banner} />}
      {actionData?.problem && (
        <Message tone="error" title={actionData.problem} className={styles.banner} />
      )}
      <Form method="post" className={styles.form}>
        <Field
          label="Site title"
          name="siteTitle"
          defaultValue={siteTitleDefault}
          maxLength={200}
          required
        />
        <input type="hidden" name="logoMediaId" value={logo?.id ?? ""} />
        <fieldset className={styles.logoField} ref={logoFieldRef}>
          <legend className={styles.logoLabel}>Logo</legend>
          {logo ? (
            <div className={styles.logoPreview}>
              <img src={logo.url} alt="" className={styles.logoImage} />
              <div className={styles.logoActions}>
                <Button type="button" variant="quiet" onClick={() => openLogoPickerDialog(setLogo)}>
                  Change logo
                </Button>
                <Button type="button" variant="quiet" onClick={() => setLogo(null)}>
                  Remove logo
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" onClick={() => openLogoPickerDialog(setLogo)}>
              Choose logo
            </Button>
          )}
        </fieldset>
        <div className={styles.navSection}>
          <h2 className={styles.navHeading}>Navigation</h2>
          <input type="hidden" name="nav-count" value={draftRows.length} />
          {draftRows.length > 0 && (
            <ol className={styles.navList}>
              {draftRows.map((row, index) => {
                const itemName = row.label || `item ${index + 1}`;
                const selectedPage = row.pageId ? pageById.get(row.pageId) : undefined;
                return (
                  <li
                    // Every add/remove/move round trip returns a fresh, fully-reshaped
                    // list, and these fields are uncontrolled (defaultValue) - keying
                    // only on position would let React reuse a row's DOM node across a
                    // reorder, leaving the old typed text sitting in the new row's
                    // place. The content is folded into the key so a changed row
                    // remounts with its new values; the index stays in it only to keep
                    // two still-blank rows apart.
                    // biome-ignore lint/suspicious/noArrayIndexKey: content, not order, is what has to force the remount here - see above.
                    key={`${index}-${row.label}-${row.pageId}-${row.url}`}
                    className={styles.navRow}
                  >
                    <fieldset className={styles.navRowFields}>
                      <legend className={styles.navRowLegend}>Item {index + 1}</legend>
                      <Field
                        label="Label"
                        name={`nav-label-${index}`}
                        defaultValue={row.label}
                        maxLength={100}
                      />
                      <div className={styles.navTargetFields}>
                        <div className={styles.selectField}>
                          <label className={styles.navFieldLabel} htmlFor={`nav-page-${index}`}>
                            Existing page
                          </label>
                          <select
                            id={`nav-page-${index}`}
                            name={`nav-pageId-${index}`}
                            defaultValue={row.pageId}
                            className={styles.select}
                          >
                            <option value="">No page</option>
                            {pages.map((page) => (
                              <option key={page.id} value={page.id}>
                                {page.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Field
                          label="Web address"
                          name={`nav-url-${index}`}
                          defaultValue={row.url}
                          placeholder="https://example.com"
                        />
                      </div>
                      {selectedPage && selectedPage.status !== "published" && (
                        <p className={styles.navHint}>Not published - hidden from visitors.</p>
                      )}
                    </fieldset>
                    <div className={styles.navRowActions}>
                      <Button
                        type="submit"
                        name="intent"
                        value={`nav-move-up-${index}`}
                        variant="quiet"
                        disabled={index === 0}
                      >
                        Move <span className="visually-hidden">{itemName} </span>up
                      </Button>
                      <Button
                        type="submit"
                        name="intent"
                        value={`nav-move-down-${index}`}
                        variant="quiet"
                        disabled={index === draftRows.length - 1}
                      >
                        Move <span className="visually-hidden">{itemName} </span>down
                      </Button>
                      <Button
                        type="submit"
                        name="intent"
                        value={`nav-remove-${index}`}
                        variant="quiet"
                      >
                        Remove<span className="visually-hidden"> {itemName}</span>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <Button
            type="submit"
            name="intent"
            value="nav-add"
            disabled={draftRows.length >= NAV_MAX_ITEMS}
          >
            Add item
          </Button>
        </div>
        <Button type="submit" name="intent" value="save" variant="primary" isPending={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </Form>
    </>
  );
}
