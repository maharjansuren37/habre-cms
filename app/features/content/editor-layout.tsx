import { Outlet } from "react-router";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import {
  getSiteBrand,
  getSiteLevel,
  type StylePreset,
} from "#app/features/settings/settings.server.ts";
import type { SiteLevel } from "#app/features/settings/site-level.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import type { Route } from "./+types/editor-layout";

/** What the editor routes hand `EntryForm` through the outlet. */
export type EditorOutletContext = {
  suspended: boolean;
  brandColor: string;
  stylePreset: StylePreset;
  siteLevel: SiteLevel;
};

export const middleware: Route.MiddlewareFunction[] = [requireUser];

// The editor drops the shell's sidebar, but not its suspended notice (F-282):
// this pathless layout loads the one fact the shell's loader gives the rest of
// the admin. A loader, so client-side navigations revalidate it too.
export async function loader({ context }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const [{ suspended }, brand, siteLevel] = await Promise.all([
    findMemberSite(siteId),
    getSiteBrand(siteId),
    getSiteLevel(siteId),
  ]);
  return { suspended, siteLevel, ...brand };
}

export default function EditorLayout({ loaderData }: Route.ComponentProps) {
  const { suspended, brandColor, stylePreset, siteLevel } = loaderData;
  return (
    <Outlet
      context={{ suspended, brandColor, stylePreset, siteLevel } satisfies EditorOutletContext}
    />
  );
}
