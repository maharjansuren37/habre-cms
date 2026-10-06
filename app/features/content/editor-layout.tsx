import { Outlet } from "react-router";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import type { Route } from "./+types/editor-layout";

/** What the editor routes hand `EntryForm` through the outlet. */
export type EditorOutletContext = { suspended: boolean };

export const middleware: Route.MiddlewareFunction[] = [requireUser];

// The editor drops the shell's sidebar, but not its suspended notice (F-282):
// this pathless layout loads the one fact the shell's loader gives the rest of
// the admin. A loader, so client-side navigations revalidate it too.
export async function loader({ context }: Route.LoaderArgs) {
  const { suspended } = await findMemberSite(context.get(userContext).siteId);
  return { suspended };
}

export default function EditorLayout({ loaderData }: Route.ComponentProps) {
  return <Outlet context={{ suspended: loaderData.suspended } satisfies EditorOutletContext} />;
}
