import { useEffect, useRef, useState } from "react";
import { data, Form, redirect, useNavigation, useRouteLoaderData } from "react-router";
import type { loader as adminLayoutLoader } from "#app/features/admin-shell/layout.tsx";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { listPagesForNav } from "#app/features/content/entries.server.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import "#app/lib/zod-jitless.client.ts";
import {
  openMediaPickerDialog,
  type PickedMedia,
} from "#app/features/media/media-picker-dialog.client.ts";
import type { Route } from "./+types/settings";
import { LANGUAGES } from "./languages.ts";
import {
  applyNavIntent,
  draftRowsToNavItems,
  type NavDraftRow,
  navItemsToDraftRows,
  parseDraftRows,
} from "./navigation-form-input.ts";
import { NAV_MAX_ITEMS } from "./navigation-input.ts";
import styles from "./settings.module.css";
import { saveSiteSettings } from "./settings.server.ts";
import {
  homePageIdSchema,
  isSettingsFormBodyAllowed,
  languageSchema,
  logoMediaIdSchema,
  siteDescriptionSchema,
  siteTitleSchema,
} from "./settings-input.ts";

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
export async function loader({ request, context }: Route.LoaderArgs) {
  const updated = new URL(request.url).searchParams.get("updated") !== null;
  const pages = await listPagesForNav(context.get(userContext).siteId);
  return { updated, pages };
}

/** What every non-redirect action response carries, whether it reshaped the
 *  draft or refused a save - one shape, so the component never has to check
 *  which kind of response it got before reading it. */
type ActionResult = {
  problem: string | null;
  draftRows: NavDraftRow[];
  siteTitle: string;
  homePageId: string;
  siteDescription: string;
  language: string;
  /** Beside-the-field refusals; empty when there are none. */
  errors: { siteDescription?: string; language?: string };
};

export async function action({ request, context }: Route.ActionArgs) {
  if (!isSettingsFormBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");
  const submittedTitle = String(form.get("siteTitle") ?? "");
  // Absent is not the same as "" (No home page): a form from before the
  // select existed, or a scripted post, must not clear the home page (F-107).
  const rawHomePageId = form.get("homePageId");
  const submittedHomePageId = String(rawHomePageId ?? "");
  // Absent, not just empty, for the same reason (F-107): a save that does not
  // carry these fields must not blank the description or reset the language.
  const rawDescription = form.get("siteDescription");
  const rawLanguage = form.get("language");
  const submittedDescription = String(rawDescription ?? "");
  const submittedLanguage = String(rawLanguage ?? "");
  const rows = parseDraftRows(form);
  const carried = {
    draftRows: rows,
    siteTitle: submittedTitle,
    homePageId: submittedHomePageId,
    siteDescription: submittedDescription,
    language: submittedLanguage,
    errors: {} as ActionResult["errors"],
  };

  // Add/remove/move only rearrange what is already on the page - no
  // database write, so nothing below this needs validating yet.
  const reshaped = applyNavIntent(intent, rows);
  if (reshaped) {
    return {
      problem: null,
      ...carried,
      draftRows: reshaped,
    } satisfies ActionResult;
  }

  if (rawHomePageId === null || rawDescription === null || rawLanguage === null) {
    return data(
      {
        problem: "This form is out of date. Reload the page and try again.",
        ...carried,
      } satisfies ActionResult,
      { status: 400 },
    );
  }

  const title = siteTitleSchema.safeParse(submittedTitle);
  if (!title.success) {
    return data(
      {
        problem: title.error.issues[0]?.message ?? "Enter a site title.",
        ...carried,
      } satisfies ActionResult,
      { status: 400 },
    );
  }
  const description = siteDescriptionSchema.safeParse(submittedDescription);
  const language = languageSchema.safeParse(submittedLanguage);
  if (!description.success || !language.success) {
    return data(
      {
        problem: "Your changes were not saved.",
        ...carried,
        errors: {
          siteDescription: description.error?.issues[0]?.message,
          language: language.error?.issues[0]?.message,
        },
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
  if (
    !logoId.success ||
    (logoId.data &&
      (await findMediaByIds(context.get(userContext).siteId, [logoId.data])).length === 0)
  ) {
    return data(
      {
        problem: "That logo could not be saved. Choose it again.",
        ...carried,
      } satisfies ActionResult,
      { status: 400 },
    );
  }

  const pages = await listPagesForNav(context.get(userContext).siteId);
  const navResult = draftRowsToNavItems(rows, new Set(pages.map((page) => page.id)));
  if (!navResult.ok) {
    return data(
      {
        problem: navResult.message,
        ...carried,
      } satisfies ActionResult,
      { status: 400 },
    );
  }

  // Checked against the page list, not just the id's shape: the foreign key
  // only proves an entry exists, so a post's id would save (D-6), and a
  // deleted page's id would reach the database as an unhandled 23503 (F-89).
  const homePage = homePageIdSchema.safeParse(submittedHomePageId);
  if (!homePage.success || (homePage.data && !pages.some((page) => page.id === homePage.data))) {
    return data(
      {
        problem: "That home page could not be saved. Choose it again.",
        ...carried,
      } satisfies ActionResult,
      { status: 400 },
    );
  }

  const saved = await saveSiteSettings(context.get(userContext).siteId, {
    siteTitle: title.data,
    logoMediaId: logoId.data,
    homePageId: homePage.data,
    navigation: navResult.items,
    siteDescription: description.data,
    language: language.data,
  });
  // The logo or page was deleted after the checks above - the save rolled back
  // whole, so this is the same answer those checks give (F-106, F-110).
  if (saved !== "saved") {
    return data(
      {
        problem:
          saved === "logo-gone"
            ? "That logo could not be saved. Choose it again."
            : "That home page could not be saved. Choose it again.",
        ...carried,
      } satisfies ActionResult,
      { status: 400 },
    );
  }
  return redirect("/admin/settings?updated=1");
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { updated, pages } = loaderData;
  // This route only renders nested inside the layout that provides this data
  // (app/routes.ts). If the id stops matching, fail loudly: a silent fallback
  // to defaults would re-save them over the real settings (F-93).
  const layoutData = useRouteLoaderData<typeof adminLayoutLoader>("features/admin-shell/layout");
  if (!layoutData) {
    throw new Error("Settings: the admin-shell layout's data is missing - check its route id.");
  }
  const { settings } = layoutData;
  const [logo, setLogo] = useState<Pick<PickedMedia, "id" | "url" | "filename"> | null>(
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
  const siteDescriptionDefault = actionData ? actionData.siteDescription : settings.siteDescription;
  const languageDefault = actionData ? actionData.language : settings.language;
  const errors = actionData?.errors ?? {};
  const homePageIdDefault = actionData ? actionData.homePageId : (settings.homePageId ?? "");
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const homePage = pageById.get(homePageIdDefault);

  // The picker's dialog closes before it hands back a pick (media-picker-dialog.client.ts),
  // which restores focus to whatever opened it - but that element is the exact
  // one this re-render is about to remove (placeholder <-> preview swap the
  // button's own root element), so the browser's restored focus lands on a node
  // that is gone by the time it paints. The fix (F-76): re-focus a button by
  // hand once the new content exists. Skipped on mount so loading an already-set logo
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
        {/* The form now has several type="submit" buttons (each nav row's
            Move up/Move down/Remove, then Add item, then Save) - pressing
            Enter in a text field implicitly submits via whichever comes
            first in the DOM, not Save (F-94: with a row present that is a
            disabled "Move up", so Enter does nothing; with none present it
            is "Add item", so Enter adds a blank row instead of saving).
            A hidden button carrying the Save intent, first in the DOM,
            makes Enter always save - the standard fix for "several submit
            buttons, one intended default." Never focusable or announced:
            it exists only for the browser's own implicit-submission rule,
            not as a second Save control a person could find. */}
        <button
          type="submit"
          name="intent"
          value="save"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
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
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => openMediaPickerDialog("Choose a logo", setLogo)}
                >
                  Change logo
                </Button>
                <Button type="button" variant="quiet" onClick={() => setLogo(null)}>
                  Remove logo
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" onClick={() => openMediaPickerDialog("Choose a logo", setLogo)}>
              Choose logo
            </Button>
          )}
        </fieldset>
        <div className={styles.selectField}>
          <label className={styles.navFieldLabel} htmlFor="siteDescription">
            Site description
          </label>
          <textarea
            id="siteDescription"
            name="siteDescription"
            defaultValue={siteDescriptionDefault}
            rows={3}
            className={styles.textarea}
            aria-invalid={errors.siteDescription ? true : undefined}
            aria-describedby={
              errors.siteDescription
                ? "siteDescription-hint siteDescription-error"
                : "siteDescription-hint"
            }
          />
          <p id="siteDescription-hint" className={styles.navHint}>
            Shown in search results and when your site is shared. Up to 300 characters.
          </p>
          {errors.siteDescription && (
            <p id="siteDescription-error" className={styles.fieldError}>
              {errors.siteDescription}
            </p>
          )}
        </div>
        <div className={styles.selectField}>
          <label className={styles.navFieldLabel} htmlFor="language">
            Language
          </label>
          <select
            id="language"
            name="language"
            defaultValue={languageDefault}
            className={styles.select}
            aria-invalid={errors.language ? true : undefined}
            aria-describedby={errors.language ? "language-hint language-error" : "language-hint"}
          >
            {LANGUAGES.map((language) => (
              <option key={language.tag} value={language.tag}>
                {language.name}
              </option>
            ))}
          </select>
          <p id="language-hint" className={styles.navHint}>
            The language your pages are written in.
          </p>
          {errors.language && (
            <p id="language-error" className={styles.fieldError}>
              {errors.language}
            </p>
          )}
        </div>
        <div className={styles.selectField}>
          <label className={styles.navFieldLabel} htmlFor="homePageId">
            Home page
          </label>
          <select
            id="homePageId"
            name="homePageId"
            defaultValue={homePageIdDefault}
            className={styles.select}
            aria-describedby={
              homePage && homePage.status !== "published" ? "homePageId-hint" : undefined
            }
          >
            <option value="">No home page</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
          {homePage && homePage.status !== "published" && (
            <p id="homePageId-hint" className={styles.navHint}>
              Not published - visitors see a placeholder until it is.
            </p>
          )}
        </div>
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
                      {row.pageId && !selectedPage && (
                        <p className={styles.navHint}>
                          This page no longer exists - choose another page or remove this item.
                        </p>
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
