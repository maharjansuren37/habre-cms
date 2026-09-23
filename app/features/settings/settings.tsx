import { useEffect, useRef, useState } from "react";
import { data, Form, redirect, useNavigation, useRouteLoaderData } from "react-router";
import type { loader as adminLayoutLoader } from "#app/features/admin-shell/layout.tsx";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/settings";
import { openLogoPickerDialog, type PickedLogo } from "./logo-picker.client.ts";
import styles from "./settings.module.css";
import { updateSiteIdentity } from "./settings.server.ts";
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
  return { updated };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const title = siteTitleSchema.safeParse(form.get("siteTitle") ?? "");
  if (!title.success) {
    return data(
      { problem: title.error.issues[0]?.message ?? "Enter a site title." },
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
    return data({ problem: "That logo could not be saved. Choose it again." }, { status: 400 });
  }
  await updateSiteIdentity({ siteTitle: title.data, logoMediaId: logoId.data });
  return redirect("/admin/settings?updated=1");
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { updated } = loaderData;
  // The fallback is practically unreachable - this route only ever renders
  // nested inside the layout that provides it (app/routes.ts) - but avoids a
  // non-null assertion for a value the type system cannot itself guarantee.
  const settings = useRouteLoaderData<typeof adminLayoutLoader>("features/admin-shell/layout")
    ?.settings ?? { siteTitle: "Habre CMS", logoMediaId: null, logoUrl: null };
  const [logo, setLogo] = useState<PickedLogo | null>(
    settings.logoMediaId && settings.logoUrl
      ? { id: settings.logoMediaId, url: settings.logoUrl, filename: "" }
      : null,
  );
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting" && navigation.formAction === "/admin/settings";

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
          defaultValue={settings.siteTitle}
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
        <Button type="submit" variant="primary" isPending={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </Form>
    </>
  );
}
